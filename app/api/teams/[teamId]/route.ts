/**
 * GET    /api/teams/[teamId] - Team details (any member of the team's organization)
 * PATCH  /api/teams/[teamId] - Update name/description (org owners/managers, or the team's lead)
 * DELETE /api/teams/[teamId] - Delete team (org owners/managers only)
 *
 * The organization is resolved from the TEAM (see getTeamAccess), so this works for users
 * who belong to several organizations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getTeamAccess } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

const TEAM_COLUMNS = 'id, name, description, created_by, created_at, updated_at';
const DEFAULT_TEAM_NAME = 'General';

type Params = { params: { teamId: string } };

export async function GET(request: NextRequest, { params }: Params) {
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

    const { data: team, error } = await supabase
      .from('teams')
      .select(TEAM_COLUMNS)
      .eq('id', params.teamId)
      .maybeSingle();

    if (error || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ ...team, can_manage: access.canManage });
  } catch (err) {
    console.error('Team GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
        { error: 'You do not have permission to update this team' },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
    } | null;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body?.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
      }
      if (body.name.trim().length > 100) {
        return NextResponse.json({ error: 'Team name must be at most 100 characters' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body?.description !== undefined) {
      if (body.description !== null && typeof body.description !== 'string') {
        return NextResponse.json({ error: 'Invalid description' }, { status: 400 });
      }
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (description.length > 1000) {
        return NextResponse.json({ error: 'Description must be at most 1000 characters' }, { status: 400 });
      }
      updates.description = description || null;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // The default team keeps its name (other code recognises it by name)
    if (updates.name !== undefined) {
      const { data: current } = await supabase
        .from('teams')
        .select('name')
        .eq('id', params.teamId)
        .maybeSingle();

      if (current?.name === DEFAULT_TEAM_NAME && updates.name !== DEFAULT_TEAM_NAME) {
        return NextResponse.json({ error: 'The General team cannot be renamed' }, { status: 400 });
      }
    }

    const { data: team, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', params.teamId)
      .select(TEAM_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A team with this name already exists' }, { status: 400 });
      }
      console.error('Failed to update team:', error);
      return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }

    return NextResponse.json(team);
  } catch (err) {
    console.error('Team PATCH error:', err);
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

    // Deleting a team is an organization-level action (team leads cannot delete their team)
    if (access.orgRole !== 'owner' && access.orgRole !== 'manager') {
      return NextResponse.json(
        { error: 'Only organization owners and managers can delete teams' },
        { status: 403 },
      );
    }

    const { data: team, error: getError } = await supabase
      .from('teams')
      .select('name')
      .eq('id', params.teamId)
      .maybeSingle();

    if (getError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.name === DEFAULT_TEAM_NAME) {
      return NextResponse.json({ error: 'Cannot delete the General team' }, { status: 400 });
    }

    const { error } = await supabase.from('teams').delete().eq('id', params.teamId);

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