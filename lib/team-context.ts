/**
 * Team Context
 *
 * Helpers to resolve a user's team context (used by API routes and UI data loading).
 *
 * Phase 2: Users can be members of multiple teams within their organization.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Team } from './types';

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
 * Get the user's team context within ONE organization.
 *
 * Two queries total (teams in the org, then the user's memberships in them),
 * regardless of how many teams exist.
 */
export async function getUserTeamContext(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<UserTeamContext> {
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (teamsError) {
    console.error('Failed to get teams:', teamsError);
    return { organizationId, teams: [] };
  }
  if (!teams || teams.length === 0) {
    return { organizationId, teams: [] };
  }

  const { data: memberships, error: memberError } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .in(
      'team_id',
      teams.map((t) => t.id),
    );

  if (memberError) {
    console.error('Failed to get team memberships:', memberError);
    return { organizationId, teams: [] };
  }

  const roleByTeam = new Map<string, 'team_lead' | 'member'>(
    (memberships ?? []).map((m) => [m.team_id, m.role as 'team_lead' | 'member']),
  );

  const userTeams: UserTeamContext['teams'] = [];
  let defaultTeamId: string | undefined;
  let defaultTeamName: string | undefined;

  for (const team of teams) {
    const role = roleByTeam.get(team.id);
    if (!role) continue;

    userTeams.push({ teamId: team.id, teamName: team.name, role });

    if (team.name === 'General') {
      defaultTeamId = team.id;
      defaultTeamName = team.name;
    }
  }

  return { organizationId, teams: userTeams, defaultTeamId, defaultTeamName };
}

/**
 * Get a specific team's details including member count.
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

  const { count: memberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);

  return { ...team, member_count: memberCount ?? 0 };
}

/**
 * Get user's role in a specific team ('team_lead', 'member', or null if not a member).
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
  if (members.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, display_name, job_title')
    .in(
      'id',
      members.map((m) => m.user_id),
    );

  if (profilesError) {
    console.error('Failed to get user profiles:', profilesError);
  }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

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
 * Check if user has the team lead role for a team.
 */
export async function isTeamLead(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<boolean> {
  const role = await getUserRoleInTeam(supabase, userId, teamId);
  return role === 'team_lead';
}