/**
 * GET  /api/teams - Teams the current user can see, across ALL of their organizations
 * POST /api/teams - Create a team (organization owners/managers only)
 */

import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizations } from '@/lib/organization-context';
import { CreateTeamSchema, validateRequest } from '@/lib/validation-schemas';
import {
  unauthorized,
  notFound,
  internalError,
  insufficientPermissions,
  validationError,
  conflict,
  createdResponse,
  successResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized();
    }

    const supabase = createServerClient();

    const orgs = await getUserOrganizations(supabase, user.userId);
    if (orgs.length === 0) {
      return successResponse({ teams: [] });
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
      return internalError('Failed to load teams');
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
      return internalError('Failed to load teams');
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

    return successResponse({
      teams: visible.map((t) => ({
        ...t,
        member_count: countByTeam.get(t.id) ?? 0,
        user_role: myRoleByTeam.get(t.id),
      })),
    });
  } catch (err) {
    console.error('Teams GET error:', err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized();
    }

    const body = await request.json().catch(() => null);
    
    // Validate request body
    const validation = validateRequest(CreateTeamSchema, body);
    if (!validation.valid) {
      return validationError(validation.error);
    }

    const supabase = createServerClient();

    // Organization is decided from the database, never trusted from the request:
    // the user must be an owner/manager of it.
    const orgs = await getUserOrganizations(supabase, user.userId);
    const managed = orgs.filter((o) => o.role === 'owner' || o.role === 'manager');

    if (managed.length === 0) {
      return insufficientPermissions('team');
    }

    const organizationId = managed[0].organizationId;

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        organization_id: organizationId,
        name: validation.data.name,
        description: validation.data.description || null,
        created_by: user.userId,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return conflict('A team with this name already exists');
      }
      console.error('Failed to create team:', error);
      return internalError('Failed to create team');
    }

    return createdResponse(team, 'Team created successfully');
  } catch (err) {
    console.error('Teams POST error:', err);
    return internalError();
  }
}