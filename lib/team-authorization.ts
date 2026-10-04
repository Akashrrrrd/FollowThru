/**
 * Team & Role-Based Authorization
 * 
 * Helpers for checking user permissions based on organizational role and team membership.
 * Critical for Phase 2: Always resolve permissions server-side, never trust frontend.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type OrganizationRole = 'owner' | 'manager' | 'member';
export type TeamRole = 'team_lead' | 'member';

export interface UserTeamRole {
  organizationId: string;
  organizationRole: OrganizationRole;
  teamId?: string;
  teamRole?: TeamRole;
}

/**
 * Get user's complete role context: org role + team role(s)
 * 
 * Returns organization role + team role if user is a team member.
 * Does NOT trust frontend-supplied values.
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to look up
 * @param organizationId - Organization to check membership
 * @returns User role context or null if not a member
 */
export async function getUserRoleInOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<OrganizationRole | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get user org role:', error);
    return null;
  }

  return data?.role as OrganizationRole | null;
}

/**
 * Get user's role within a specific team
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns Team role or null if not a member
 */
export async function getUserRoleInTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<TeamRole | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get user team role:', error);
    return null;
  }

  return data?.role as TeamRole | null;
}

/**
 * Check if user is a manager in organization
 * Managers can manage teams, add/remove members, etc.
 */
export async function isManagerInOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const role = await getUserRoleInOrganization(supabase, userId, organizationId);
  return role === 'owner' || role === 'manager';
}

/**
 * Check if user is a team lead for a specific team
 * Team leads can manage their team's members
 */
export async function isTeamLeadInTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<boolean> {
  const role = await getUserRoleInTeam(supabase, userId, teamId);
  return role === 'team_lead';
}

/**
 * Check if user can manage a team
 * Managers can manage any team in their org.
 * Team leads can only manage their own team.
 */
export async function canManageTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  organizationId: string,
): Promise<boolean> {
  // Check if manager in org (can manage any team)
  if (await isManagerInOrganization(supabase, userId, organizationId)) {
    return true;
  }

  // Check if team lead of this specific team
  if (await isTeamLeadInTeam(supabase, userId, teamId)) {
    return true;
  }

  return false;
}

/**
 * Check if user belongs to a team
 * (needed for viewing team data)
 */
export async function isMemberOfTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) {
    console.error('Failed to check team membership:', error);
    return false;
  }

  return !!data;
}

/**
 * Get all teams user can access (teams in their organization)
 */
export async function getUserTeams(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Array<{ teamId: string; teamName: string; role: TeamRole }>> {
  // Get all teams in org
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('organization_id', organizationId);

  if (teamsError) {
    console.error('Failed to get teams:', teamsError);
    return [];
  }

  // Get user's role in each team
  const results = [];
  for (const team of teams ?? []) {
    const role = await getUserRoleInTeam(supabase, userId, team.id);
    if (role) {
      results.push({
        teamId: team.id,
        teamName: team.name,
        role,
      });
    }
  }

  return results;
}

/**
 * Get team members (with roles)
 */
export async function getTeamMembers(
  supabase: SupabaseClient,
  teamId: string,
): Promise<Array<{ userId: string; email: string; displayName: string; role: TeamRole }>> {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      user_id,
      role
    `)
    .eq('team_id', teamId);

  if (error) {
    console.error('Failed to get team members:', error);
    return [];
  }

  // Get user profiles for display names/emails
  if (!data || data.length === 0) {
    return [];
  }

  const userIds = data.map((tm) => tm.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .in('id', userIds);

  if (profilesError) {
    console.error('Failed to get user profiles:', profilesError);
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((tm) => {
    const profile = profileMap.get(tm.user_id);
    return {
      userId: tm.user_id,
      email: '', // TODO: fetch from auth.users if needed
      displayName: profile?.display_name || 'Unknown',
      role: tm.role as TeamRole,
    };
  });
}

/**
 * Verify team belongs to organization
 * (security check to prevent cross-org access)
 */
export async function teamBelongsToOrganization(
  supabase: SupabaseClient,
  teamId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to verify team org membership:', error);
    return false;
  }

  return !!data;
}
