/**
 * GET /api/teams/[teamId] - Get team details
 * PATCH /api/teams/[teamId] - Update team (managers only)
 * DELETE /api/teams/[teamId] - Delete team (managers only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { canManageTeam, teamBelongsToOrganization } from '@/lib/team-authorization';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } },
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

    // Get team details
    const { data: team, error } = await supabase
      .from('teams')
      .select('id, name, description, created_by, created_at, updated_at')
      .eq('id', params.teamId)
      .single();

    if (error || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json(team);
  } catch (err) {
    console.error('Team GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { teamId: string } },
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
      return NextResponse.json({ error: 'You do not have permission to update this team' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    const { data: team, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', params.teamId)
      .select('id, name, description, created_by, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }

    return NextResponse.json(team);
  } catch (err) {
    console.error('Team PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { teamId: string } },
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
      return NextResponse.json({ error: 'You do not have permission to delete this team' }, { status: 403 });
    }

    // Do not allow deletion of General team (safety)
    const { data: team, error: getError } = await supabase
      .from('teams')
      .select('name')
      .eq('id', params.teamId)
      .single();

    if (getError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.name === 'General') {
      return NextResponse.json({ error: 'Cannot delete the General team' }, { status: 400 });
    }

    // Delete team (cascades to team_members)
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', params.teamId);

    if (error) {
      console.error('Failed to delete team:', error);
      return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Team DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
