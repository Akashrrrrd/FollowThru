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

    // Get all teams in the organization with their members
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
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to fetch teams:', error);

      return NextResponse.json(
        { error: 'Failed to fetch teams' },
        { status: 500 }
      );
    }

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
    console.error('Teams GET error:', err);

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