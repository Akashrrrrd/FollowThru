/**
 * DEBUG ENDPOINT - Shows team membership state for testing
 * WARNING: This exposes internal data and should only exist during debugging
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

    // Get user info
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user.userId);
    const userEmail = authUser?.email || '';

    // Get org membership
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', user.userId);

    // Get team memberships
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', user.userId);

    // Get all teams in their org
    const userOrg = orgMembers?.[0]?.organization_id;
    const { data: allTeams } = userOrg
      ? await supabase
          .from('teams')
          .select('*')
          .eq('organization_id', userOrg)
      : { data: [] };

    // Get pending invitations for this user's email
    const { data: pendingInvitations } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('email', userEmail)
      .eq('status', 'pending');

    return NextResponse.json(
      {
        user: {
          id: user.userId,
          email: userEmail,
        },
        organization_members: orgMembers || [],
        team_members: teamMembers || [],
        all_teams_in_org: allTeams || [],
        pending_invitations: pendingInvitations || [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[DEBUG /api/debug/team-state] Error:', err);
    return NextResponse.json(
      { error: 'Debug query failed' },
      { status: 500 }
    );
  }
}
