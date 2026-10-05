/**
 * GET  /api/teams - Teams the current user can see, across ALL of their organizations
 * POST /api/teams - Create a team (organization owners/managers only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizations } from '@/lib/organization-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const orgs = await getUserOrganizations(supabase, user.userId);
    if (orgs.length === 0) {
      return NextResponse.json({ teams: [] });
    }

    const orgIds = orgs.map((o) => o.organizationId);
    const managedOrgIds = new Set(
      orgs.filter((o) => o.role === 'owner' || o.role === 'manager').map((o) => o.organizationId),
    );

    // The user's own team memberships
    const { data: myMemberships, error: myError } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.userId);

    if (myError) {
      console.error('Failed to load team memberships:', myError);
      return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 });
    }

    const myRoleByTeam = new Map<string, 'team_lead' | 'member'>(
      (myMemberships ?? []).map((m) => [m.team_id, m.role as 'team_lead' | 'member']),
    );

    // Only teams inside organizations the user actually belongs to
    const { data: allTeams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .in('organization_id', orgIds)
      .order('created_at', { ascending: true });

    if (teamsError) {
      console.error('Failed to load teams:', teamsError);
      return NextResponse.json({ error: 'Failed to load teams' }, { status: 500 });
    }

    // Owners/managers see every team in their org; members see only their own teams
    const visible = (allTeams ?? []).filter(
      (t) => managedOrgIds.has(t.organization_id) || myRoleByTeam.has(t.id),
    );

    const countByTeam = new Map<string, number>();
    if (visible.length > 0) {
      const { data: rows, error: countError } = await supabase
        .from('team_members')
        .select('team_id')
        .in(
          'team_id',
          visible.map((t) => t.id),
        );

      if (countError) {
        console.warn('Failed to load member counts:', countError);
      }
      for (const r of rows ?? []) {
        countByTeam.set(r.team_id, (countByTeam.get(r.team_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      teams: visible.map((t) => ({
        ...t,
        member_count: countByTeam.get(t.id) ?? 0,
        user_role: myRoleByTeam.get(t.id),
      })),
    });
  } catch (err) {
    console.error('Teams GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
      organization_id?: unknown;
    } | null;

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null;

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Team name must be at most 100 characters' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Organization is decided from the database, never trusted from the request:
    // the user must be an owner/manager of it.
    const orgs = await getUserOrganizations(supabase, user.userId);
    const managed = orgs.filter((o) => o.role === 'owner' || o.role === 'manager');

    if (managed.length === 0) {
      return NextResponse.json(
        { error: 'Only organization owners and managers can create teams' },
        { status: 403 },
      );
    }

    let organizationId = managed[0].organizationId;
    if (typeof body?.organization_id === 'string') {
      const requested = managed.find((o) => o.organizationId === body.organization_id);
      if (!requested) {
        return NextResponse.json(
          { error: 'You cannot create teams in that organization' },
          { status: 403 },
        );
      }
      organizationId = requested.organizationId;
    }

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        organization_id: organizationId,
        name,
        description,
        created_by: user.userId,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A team with this name already exists' },
          { status: 400 },
        );
      }
      console.error('Failed to create team:', error);
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }

    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    console.error('Teams POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}