/**
 * GET /api/debug/migration-status - Check Phase 2 team migration status
 * 
 * Returns migration statistics and any issues found.
 * Admin/manager endpoint for verifying data integrity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { isManagerInOrganization } from '@/lib/team-authorization';
import { getMigrationStatus } from '@/lib/team-migration';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Only managers can check migration status
    const isManager = await isManagerInOrganization(supabase, user.userId, orgContext.organizationId);
    if (!isManager) {
      return NextResponse.json(
        { error: 'Only managers can check migration status' },
        { status: 403 },
      );
    }

    // Get migration status
    const status = await getMigrationStatus(supabase);

    return NextResponse.json(status);
  } catch (err) {
    console.error('Migration status check error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
