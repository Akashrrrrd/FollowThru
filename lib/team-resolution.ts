/**
 * Team Resolution Service
 *
 * Resolves a user to their active team membership.
 * Once we have an assigned user, find which team they belong to.
 *
 * Rules:
 * - Team must belong to same organization
 * - User must be active member (not removed/inactive)
 * - If exactly one team: resolve automatically
 * - If multiple teams: return MULTIPLE_TEAMS (don't arbitrarily choose)
 * - If no team: return UNASSIGNED_TEAM (don't invent one)
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type TeamResolutionStatus = 'resolved' | 'multiple_teams' | 'unassigned_team';

export interface TeamOption {
  teamId: string;
  teamName: string;
  memberCount?: number;
}

export interface TeamResolutionResult {
  status: TeamResolutionStatus;
  teamId?: string; // Set if resolved
  teamName?: string; // Set if resolved
  candidates?: TeamOption[]; // Set if multiple_teams
  reason?: string; // Explanation of result
}

/**
 * Resolve user to their team(s) within an organization.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to resolve
 * @param organizationId - Organization context
 * @param meetingTeamId - Optional: team_id from meeting (preferred if user is member)
 * @returns Team resolution result
 */
export async function resolveUserToTeam(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  meetingTeamId?: string,
): Promise<TeamResolutionResult> {
  // Validate inputs
  if (!userId) {
    return {
      status: 'unassigned_team',
      reason: 'No user ID provided',
    };
  }

  if (!organizationId) {
    return {
      status: 'unassigned_team',
      reason: 'No organization context provided',
    };
  }

  try {
    // Fetch user's team memberships in this organization
    const { data: memberships, error: membershipsError } = await supabase
      .from('team_members')
      .select(
        `
        id,
        team_id,
        role,
        teams!inner(
          id,
          name,
          organization_id
        )
      `,
      )
      .eq('user_id', userId)
      .eq('teams.organization_id', organizationId);

    if (membershipsError) {
      console.error('[team-resolution] Failed to fetch team memberships:', membershipsError);
      return {
        status: 'unassigned_team',
        reason: 'Failed to query team memberships',
      };
    }

    if (!memberships || memberships.length === 0) {
      return {
        status: 'unassigned_team',
        reason: `User is not a member of any team in this organization`,
      };
    }

    // Build candidate list
    const candidates: TeamOption[] = [];

    for (const membership of memberships) {
      const teams = membership.teams as Array<{ id: string; name: string; organization_id: string }>;
      const team = teams && teams.length > 0 ? teams[0] : null;
      if (!team) continue;

      candidates.push({
        teamId: team.id,
        teamName: team.name,
      });
    }

    // If exactly one team, resolve automatically
    if (candidates.length === 1) {
      const team = candidates[0];
      return {
        status: 'resolved',
        teamId: team.teamId,
        teamName: team.teamName,
        reason: `User is a member of one team: ${team.teamName}`,
      };
    }

    // Multiple teams: check if meeting specifies one and user is in it
    if (meetingTeamId) {
      const matchingTeam = candidates.find((t) => t.teamId === meetingTeamId);
      if (matchingTeam) {
        return {
          status: 'resolved',
          teamId: matchingTeam.teamId,
          teamName: matchingTeam.teamName,
          reason: `User is member of meeting's team: ${matchingTeam.teamName}`,
        };
      }
    }

    // Multiple teams and no clear preference: require human selection
    return {
      status: 'multiple_teams',
      candidates,
      reason: `User is member of ${candidates.length} teams; team assignment requires review`,
    };
  } catch (err) {
    console.error('[team-resolution] Unexpected error:', err);
    return {
      status: 'unassigned_team',
      reason: 'Unexpected error during team resolution',
    };
  }
}

/**
 * Check if a user belongs to a specific team within an organization.
 * Useful for validation.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @param teamId - Team ID
 * @returns true if user is active member of team
 */
export async function isUserInTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (error) {
      console.error('[team-resolution] Error checking team membership:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[team-resolution] Unexpected error:', err);
    return false;
  }
}

/**
 * Get team details with member count.
 *
 * @param supabase - Authenticated Supabase client
 * @param teamId - Team ID
 * @returns Team with member count, or null if not found
 */
export async function getTeamDetails(
  supabase: SupabaseClient,
  teamId: string,
): Promise<(TeamOption & { memberCount: number }) | null> {
  try {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError || !team) {
      return null;
    }

    const { count, error: countError } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    if (countError) {
      console.error('[team-resolution] Error counting team members:', countError);
    }

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount: count ?? 0,
    };
  } catch (err) {
    console.error('[team-resolution] Unexpected error:', err);
    return null;
  }
}
