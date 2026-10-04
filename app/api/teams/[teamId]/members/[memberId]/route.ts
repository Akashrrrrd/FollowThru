/**
 * PATCH /api/teams/[teamId]/members/[memberId] - Update member role
 * DELETE /api/teams/[teamId]/members/[memberId] - Remove member from team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { canManageTeam, teamBelongsToOrganization } from '@/lib/team-authorization';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { teamId: string; memberId: string } },
) {
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

    // Verify team belongs to org
    const teamValid = await teamBelongsToOrganization(
      supabase,
      params.teamId,
      orgContext.organizationId,
    );
    if (!teamValid) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user can manage team
    const canManage = await canManageTeam(
      supabase,
      user.userId,
      params.teamId,
      orgContext.organizationId,
    );
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this team' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { role } = body as { role?: string };

    if (!role || !['team_lead', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Update member role
    const { data: member, error } = await supabase
      .from('team_members')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', params.memberId)
      .eq('team_id', params.teamId)
      .select('id, team_id, user_id, role, created_at, updated_at')
      .single();

    if (error || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (err) {
    console.error('Team member PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string; memberId: string } },
) {
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

    // Verify team belongs to org
    const teamValid = await teamBelongsToOrganization(
      supabase,
      params.teamId,
      orgContext.organizationId,
    );
    if (!teamValid) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user can manage team
    const canManage = await canManageTeam(
      supabase,
      user.userId,
      params.teamId,
      orgContext.organizationId,
    );
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this team' },
        { status: 403 },
      );
    }

    // Get member to verify existence
    const { data: member, error: getError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('id', params.memberId)
      .eq('team_id', params.teamId)
      .maybeSingle();

    if (getError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Don't allow manager to remove themselves (would leave team leaderless)
    if (member.user_id === user.userId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the team' },
        { status: 400 },
      );
    }

    // Remove member from team
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', params.memberId);

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
