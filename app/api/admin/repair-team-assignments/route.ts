/**
 * POST /api/admin/repair-team-assignments - Repair missing team assignments
 * 
 * Idempotent endpoint to fix any users or data that were missed during migration.
 * Adds missing users to their organization's default team.
 * Only accessible to org managers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { isManagerInOrganization } from '@/lib/team-authorization';
import { repairOrganizationTeamAssignments } from '@/lib/team-migration';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get user's org
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 403 });
    }

    // Only managers can repair team assignments
    const isManager = await isManagerInOrganization(supabase, user.userId, orgContext.organizationId);
    if (!isManager) {
      return NextResponse.json(
        { error: 'Only managers can repair team assignments' },
        { status: 403 },
      );
    }

    // Repair team assignments
    const repaired = await repairOrganizationTeamAssignments(
      supabase,
      orgContext.organizationId,
    );

    return NextResponse.json({
      success: true,
      message: `Repair complete. Added ${repaired} user(s) to default team.`,
      users_repaired: repaired,
    });
  } catch (err) {
    console.error('Team assignment repair error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
