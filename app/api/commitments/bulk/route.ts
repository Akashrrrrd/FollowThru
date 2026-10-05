/**
 * Bulk Commitment Actions API
 *
 * POST /api/commitments/bulk
 *
 * Executes bulk operations on multiple commitments:
 * - assign: Assign unassigned commitments to a user
 * - reassign: Change assignee of multiple commitments
 * - status: Update status
 * - due_date: Update due dates
 * - priority: Update priority
 *
 * Security: Enforces organization and team isolation. User must have
 * authorization (manager/owner for org, or team lead for team).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  getUserFromRequest,
} from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeams } from '@/lib/team-authorization';
import {
  executeBulkAction,
  type BulkActionRequest,
} from '@/lib/bulk-action-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    /*
     * -------------------------------------------------------
     * AUTHENTICATION
     * -------------------------------------------------------
     */

    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    /*
     * -------------------------------------------------------
     * ORGANIZATION CONTEXT
     * -------------------------------------------------------
     */

    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId
    );

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * AUTHORIZATION: Manager/Owner or Team Lead
     * -------------------------------------------------------
     */

    const isManager =
      orgContext.role === 'owner' || orgContext.role === 'manager';

    // For non-managers, get their authorized teams
    let authorizedTeamIds: Set<string> = new Set();
    if (!isManager) {
      const userTeams = await getUserTeams(
        supabase,
        user.userId,
        orgContext.organizationId
      );
      // Only include teams where user is team_lead
      authorizedTeamIds = new Set(
        userTeams
          .filter((t: any) => t.role === 'team_lead')
          .map((t: any) => t.teamId)
      );
    }

    if (!isManager && authorizedTeamIds.size === 0) {
      return NextResponse.json(
        {
          error: 'User does not have authorization to perform bulk actions',
        },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * PARSE REQUEST
     * -------------------------------------------------------
     */

    let body: BulkActionRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * VALIDATE REQUEST
     * -------------------------------------------------------
     */

    if (!body.action || !body.commitmentIds || !Array.isArray(body.commitmentIds)) {
      return NextResponse.json(
        {
          error: 'Missing required fields: action, commitmentIds (array)',
        },
        { status: 400 }
      );
    }

    if (body.commitmentIds.length === 0) {
      return NextResponse.json(
        { error: 'commitmentIds array cannot be empty' },
        { status: 400 }
      );
    }

    // Limit bulk size to prevent abuse
    const MAX_BULK_SIZE = 1000;
    if (body.commitmentIds.length > MAX_BULK_SIZE) {
      return NextResponse.json(
        {
          error: `Bulk action limited to ${MAX_BULK_SIZE} commitments per request`,
        },
        { status: 400 }
      );
    }

    if (!body.value) {
      return NextResponse.json(
        { error: 'Missing required field: value' },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * VERIFY AUTHORIZATION FOR NON-MANAGERS
     * -------------------------------------------------------
     *
     * For team leads, verify all commitments belong to authorized teams.
     */

    if (!isManager) {
      // Fetch all commitments to verify access
      const { data: commitments, error: fetchError } = await supabase
        .from('tasks')
        .select('id, team_id, organization_id')
        .in('id', body.commitmentIds)
        .eq('organization_id', orgContext.organizationId);

      if (fetchError) {
        return NextResponse.json(
          { error: 'Failed to verify commitments' },
          { status: 500 }
        );
      }

      // Verify all commitments belong to authorized teams
      for (const commitment of commitments || []) {
        if (
          commitment.team_id &&
          !authorizedTeamIds.has(commitment.team_id)
        ) {
          return NextResponse.json(
            {
              error: `Unauthorized: cannot modify commitments in team ${commitment.team_id}`,
            },
            { status: 403 }
          );
        }
      }
    }

    /*
     * -------------------------------------------------------
     * EXECUTE BULK ACTION
     * -------------------------------------------------------
     */

    const result = await executeBulkAction(
      supabase,
      user.userId,
      orgContext.organizationId,
      body
    );

    /*
     * -------------------------------------------------------
     * DETERMINE HTTP STATUS
     * -------------------------------------------------------
     */

    // All succeeded: 200
    if (result.failedCount === 0) {
      return NextResponse.json(result, { status: 200 });
    }

    // Some succeeded, some failed: 422 (Unprocessable Entity)
    if (result.successCount > 0) {
      return NextResponse.json(result, { status: 422 });
    }

    // All failed: 400
    return NextResponse.json(result, { status: 400 });
  } catch (err) {
    console.error('[Bulk Action API] Error:', err);

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
