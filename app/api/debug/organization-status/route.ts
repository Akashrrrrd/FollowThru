/**
 * GET /api/debug/organization-status
 * 
 * DIAGNOSTIC ONLY - Check if user has organization membership.
 * Does NOT require authentication. Returns detailed diagnostic info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Check if user has organization_members row
    const { data: orgMembers, error: orgError } = await supabase
      .from('organization_members')
      .select('organization_id, role, created_at')
      .eq('user_id', user.userId);

    if (orgError) {
      return NextResponse.json({
        user_id: user.userId,
        query_error: orgError.message,
        status: 'query_failed',
      }, { status: 500 });
    }

    if (!orgMembers || orgMembers.length === 0) {
      // User has no organization membership
      return NextResponse.json({
        user_id: user.userId,
        organization_members_count: 0,
        status: 'no_organization',
        message: 'User has no organization membership. This is the root cause of the 403 errors.',
        next_action: 'Run /api/organizations/current to initialize organization for this user.',
      }, { status: 200 });
    }

    // User has organization membership
    return NextResponse.json({
      user_id: user.userId,
      organization_members_count: orgMembers.length,
      memberships: orgMembers,
      status: 'ok',
      message: 'User has organization membership. Issue is elsewhere.',
    }, { status: 200 });
  } catch (err) {
    console.error('[debug] Organization status check error:', err);
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
