/**
 * GET /api/teams - List teams in organization
 * POST /api/teams - Create new team (managers only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { isManagerInOrganization } from '@/lib/team-authorization';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      console.log('[/api/teams] No user from request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[/api/teams] User ${user.userId} requesting teams`);
    
    const supabase = createServerClient();

    // Get user's organization
    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId
    );

    if (!orgContext) {
      console.log(`[/api/teams] User ${user.userId} has no organization`);
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 403 }
      );
    }

    console.log(`[/api/teams] User ${user.userId} org ${orgContext.organizationId}`);

    // Query team_members to find teams where the current user is a member
    const { data: userMemberships, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.userId);

    if (membershipError) {
      console.error('[/api/teams] Failed to fetch user team memberships:', membershipError);
      return NextResponse.json(
        { error: 'Failed to fetch team memberships' },
        { status: 500 }
      );
    }

    // If user has no team memberships, return empty array
    const userTeamIds = (userMemberships ?? []).map(m => m.team_id);
    
    console.log(`[/api/teams] User ${user.userId} has ${userTeamIds.length} team memberships: ${userTeamIds.join(', ')}`);
    
    if (userTeamIds.length === 0) {
      console.log(`[/api/teams] Returning empty teams for user ${user.userId}`);
      return NextResponse.json({
        teams: [],
      });
    }

    // Get teams where the user is a member
    const { data: teams, error } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at,
        team_members (
          id,
          user_id,
          role
        )
      `)
      .eq('organization_id', orgContext.organizationId)
      .in('id', userTeamIds)
      .order('name', { ascending: true });

    if (error) {
      console.error('[/api/teams] Failed to fetch teams:', error);

      return NextResponse.json(
        { error: 'Failed to fetch teams' },
        { status: 500 }
      );
    }

    console.log(`[/api/teams] Fetched ${teams?.length ?? 0} teams for user ${user.userId}`);

    const formattedTeams = (teams ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      created_by: team.created_by,
      created_at: team.created_at,
      updated_at: team.updated_at,
      member_count: team.team_members?.length ?? 0,
      team_members: team.team_members ?? [],
    }));

    return NextResponse.json({
      teams: formattedTeams,
    });
  } catch (err) {
    console.error('[/api/teams] Teams GET error:', err);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Get user's organization
    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId
    );

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 403 }
      );
    }

    // Check if user is a manager
    const isManager = await isManagerInOrganization(
      supabase,
      user.userId,
      orgContext.organizationId
    );

    if (!isManager) {
      return NextResponse.json(
        { error: 'Only managers can create teams' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      name,
      description,
    } = body as {
      name?: string;
      description?: string;
    };

    // Validate team name
    if (
      !name ||
      typeof name !== 'string' ||
      name.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    // Create team
    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        organization_id: orgContext.organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        created_by: user.userId,
      })
      .select(`
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Failed to create team:', error);

      return NextResponse.json(
        { error: 'Failed to create team' },
        { status: 500 }
      );
    }

    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    console.error('Teams POST error:', err);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}