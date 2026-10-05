/**
 * Bulk Commitment Actions API
 *
 * POST /api/commitments/bulk
 *
 * Actions: assign, reassign, status, due_date, priority
 *
 * Security model:
 *  - The organization is derived from the COMMITMENTS themselves (database), never from the
 *    request and never from "the user's first organization".
 *  - All commitments in one request must belong to a single organization, and the caller
 *    must be a member of it.
 *  - Org owners/managers may act on any commitment in the organization.
 *  - Team leads may act only on commitments whose team they lead.
 *    (Commitments with NO team are manager-only.)
 *  - Everyone else gets 403.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import {
  executeBulkAction,
  fetchCommitmentsByIds,
  type BulkActionRequest,
  type BulkActionType,
} from '@/lib/bulk-action-service';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: BulkActionType[] = ['assign', 'reassign', 'status', 'due_date', 'priority'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BULK_SIZE = 1000;

export async function POST(req: NextRequest) {
  try {
    /* ---------------- Authentication ---------------- */
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    /* ---------------- Parse + validate request ---------------- */
    let raw: any;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!raw || !VALID_ACTIONS.includes(raw.action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!Array.isArray(raw.commitmentIds) || raw.commitmentIds.length === 0) {
      return NextResponse.json(
        { error: 'commitmentIds must be a non-empty array' },
        { status: 400 },
      );
    }

    if (
      raw.commitmentIds.some((id: unknown) => typeof id !== 'string' || !UUID_RE.test(id))
    ) {
      return NextResponse.json({ error: 'commitmentIds must be valid UUIDs' }, { status: 400 });
    }

    const commitmentIds: string[] = Array.from(new Set(raw.commitmentIds as string[]));

    if (commitmentIds.length > MAX_BULK_SIZE) {
      return NextResponse.json(
        { error: `Bulk action limited to ${MAX_BULK_SIZE} commitments per request` },
        { status: 400 },
      );
    }

    if (!raw.value || typeof raw.value !== 'object' || Array.isArray(raw.value)) {
      return NextResponse.json({ error: 'value must be an object' }, { status: 400 });
    }

    const body: BulkActionRequest = {
      action: raw.action,
      commitmentIds,
      value: raw.value,
    };

    const supabase = createServerClient();

    /* ---------------- Resolve organization FROM the commitments ---------------- */
    const { data: found, error: fetchError } = await fetchCommitmentsByIds(
      supabase,
      commitmentIds,
      'id, organization_id, team_id',
    );

    if (fetchError) {
      console.error('[Bulk Action API] Failed to load commitments:', fetchError);
      return NextResponse.json({ error: 'Failed to verify commitments' }, { status: 500 });
    }

    // Same answer for "doesn't exist" and "not yours": don't leak what exists in other orgs
    if (found.length === 0) {
      return NextResponse.json({ error: 'Commitments not found' }, { status: 404 });
    }

    const orgIds = new Set<string | null>(found.map((c: any) => c.organization_id ?? null));
    if (orgIds.size !== 1) {
      return NextResponse.json(
        { error: 'All commitments must belong to the same organization' },
        { status: 400 },
      );
    }

    const organizationId = [...orgIds][0];
    if (!organizationId) {
      return NextResponse.json({ error: 'Commitments not found' }, { status: 404 });
    }

    /* ---------------- Authorization ---------------- */
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (orgError) {
      console.error('[Bulk Action API] Failed to verify membership:', orgError);
      return NextResponse.json({ error: 'Failed to verify authorization' }, { status: 500 });
    }
    if (!orgMember) {
      return NextResponse.json({ error: 'Commitments not found' }, { status: 404 });
    }

    const isManager = orgMember.role === 'owner' || orgMember.role === 'manager';

    if (!isManager) {
      const teamIds = Array.from(
        new Set(found.map((c: any) => c.team_id).filter((t: unknown): t is string => !!t)),
      );

      let ledTeams = new Set<string>();
      if (teamIds.length > 0) {
        const { data: leadRows, error: leadError } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.userId)
          .eq('role', 'team_lead')
          .in('team_id', teamIds);

        if (leadError) {
          console.error('[Bulk Action API] Failed to verify team lead role:', leadError);
          return NextResponse.json({ error: 'Failed to verify authorization' }, { status: 500 });
        }
        ledTeams = new Set((leadRows ?? []).map((r: any) => r.team_id));
      }

      // Commitments without a team are NOT covered by any team lead role
      const forbidden = found.filter((c: any) => !c.team_id || !ledTeams.has(c.team_id));
      if (forbidden.length > 0) {
        return NextResponse.json(
          {
            error:
              ledTeams.size === 0
                ? 'You do not have permission to perform bulk actions'
                : `You can only change commitments in teams you lead (${forbidden.length} not permitted)`,
          },
          { status: 403 },
        );
      }
    }

    /* ---------------- Execute ---------------- */
    const result = await executeBulkAction(supabase, user.userId, organizationId, body);

    if (result.failedCount === 0) {
      return NextResponse.json(result, { status: 200 });
    }
    if (result.successCount > 0) {
      return NextResponse.json(result, { status: 422 }); // partial success
    }
    return NextResponse.json(result, { status: 400 }); // everything failed
  } catch (err) {
    console.error('[Bulk Action API] Error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}