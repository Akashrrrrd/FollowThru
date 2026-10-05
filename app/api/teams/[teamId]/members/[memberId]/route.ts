/**
 * PATCH  /api/teams/[teamId]/members/[memberId] - Change a member's role
 * DELETE /api/teams/[teamId]/members/[memberId] - Remove a member from the team
 *
 * Who can do what:
 *  - Org owners/managers: change any role, remove anyone (except themselves).
 *  - Team lead of THIS team: remove regular members (except themselves).
 *    Team leads cannot change roles and cannot remove another team lead,
 *    so a lead can't promote people or demote/remove other leads.
 *  - Everyone else: 403.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getTeamAccess } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

type Params = { params: { teamId: string; memberId: string } };

const isOrgManager = (role: string) => role === 'owner' || role === 'manager';

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const access = await getTeamAccess(supabase, user.userId, params.teamId);
    if (!access) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    if (!access.canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this team' },
        { status: 403 },
      );
    }
    if (!isOrgManager(access.orgRole)) {
      return NextResponse.json(
        { error: 'Only organization owners and managers can change roles' },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as { role?: string } | null;
    const role = body?.role;

    if (!role || !['team_lead', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { data: member, error } = await supabase
      .from('team_members')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', params.memberId)
      .eq('team_id', params.teamId)
      .select('id, team_id, user_id, role, created_at, updated_at')
      .maybeSingle();

    if (error) {
      console.error('Failed to update member role:', error);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (err) {
    console.error('Team member PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const access = await getTeamAccess(supabase, user.userId, params.teamId);
    if (!access) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    if (!access.canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this team' },
        { status: 403 },
      );
    }

    const { data: member, error: getError } = await supabase
      .from('team_members')
      .select('id, user_id, role')
      .eq('id', params.memberId)
      .eq('team_id', params.teamId)
      .maybeSingle();

    if (getError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (member.user_id === user.userId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the team' },
        { status: 400 },
      );
    }

    if (member.role === 'team_lead' && !isOrgManager(access.orgRole)) {
      return NextResponse.json(
        { error: 'Only organization owners and managers can remove a team lead' },
        { status: 403 },
      );
    }

    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', params.memberId)
      .eq('team_id', params.teamId);

    if (deleteError) {
      console.error('Failed to remove team member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Team member DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}