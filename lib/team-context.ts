/**
 * Team Context
 * 
 * Client-side helpers to resolve user's team context.
 * Provides team information for UI components and data filtering.
 * 
 * Phase 2: Users can be members of multiple teams within their organization.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Team, TeamMember } from './types';

export interface UserTeamContext {
  organizationId: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    role: 'team_lead' | 'member';
  }>;
  defaultTeamId?: string;
  defaultTeamName?: string;
}

/**
 * Get the user's complete team context within an organization.
 * 
 * Returns all teams the user is a member of, with their role in each team.
 * Includes the default "General" team if it exists.
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns Team context with list of teams and roles
 */
export async function getUserTeamContext(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<UserTeamContext> {
  // Get all teams in the organization
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (teamsError) {
    console.error('Failed to get teams:', teamsError);
    return {
      organizationId,
      teams: [],
    };
  }

  // Get user's membership in each team
  const userTeams = [];
  let defaultTeamId: string | undefined;
  let defaultTeamName: string | undefined;

  for (const team of teams ?? []) {
    // Get user's role in this team
    const { data: membership, error: memberError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberError) {
      console.error('Failed to get team membership:', memberError);
      continue;
    }

    if (membership) {
      userTeams.push({
        teamId: team.id,
        teamName: team.name,
        role: membership.role as 'team_lead' | 'member',
      });

      // Track default team
      if (team.name === 'General') {
        defaultTeamId = team.id;
        defaultTeamName = team.name;
      }
    }
  }

  return {
    organizationId,
    teams: userTeams,
    defaultTeamId,
    defaultTeamName,
  };
}

/**
 * Get a specific team's details including member count.
 * Used for team cards and detail views.
 * 
 * @param supabase - Authenticated Supabase client
 * @param teamId - Team ID
 * @returns Team with member count, or null if not found
 */
export async function getTeamWithMemberCount(
  supabase: SupabaseClient,
  teamId: string,
): Promise<(Team & { member_count: number }) | null> {
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .maybeSingle();

  if (teamError || !team) {
    return null;
  }

  // Count members
  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);

  return {
    ...team,
    member_count: memberCount ?? 0,
  };
}

/**
 * Get user's role in a specific team.
 * Used for permission checks in UI.
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns 'team_lead', 'member', or null if not a member
 */
export async function getUserRoleInTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<'team_lead' | 'member' | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get team role:', error);
    return null;
  }

  return (data?.role as 'team_lead' | 'member') || null;
}

/**
 * List all members of a team with their profile info.
 * Used for team member displays.
 * 
 * @param supabase - Authenticated Supabase client
 * @param teamId - Team ID
 * @returns Array of team members with user profile data
 */
export async function getTeamMembersWithProfiles(
  supabase: SupabaseClient,
  teamId: string,
): Promise<
  Array<{
    id: string;
    userId: string;
    role: 'team_lead' | 'member';
    displayName: string;
    jobTitle?: string | null;
  }>
> {
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('id, user_id, role')
    .eq('team_id', teamId);

  if (membersError || !members) {
    console.error('Failed to get team members:', membersError);
    return [];
  }

  // Get user profiles for display
  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, display_name, job_title')
    .in('id', userIds);

  if (profilesError) {
    console.error('Failed to get user profiles:', profilesError);
  }

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  return members.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      userId: m.user_id,
      role: m.role as 'team_lead' | 'member',
      displayName: profile?.display_name || 'Unknown',
      jobTitle: profile?.job_title || undefined,
    };
  });
}

/**
 * Check if user has team lead role (for permissions).
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns true if user is team lead
 */
export async function isTeamLead(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<boolean> {
  const role = await getUserRoleInTeam(supabase, userId, teamId);
  return role === 'team_lead';
}
