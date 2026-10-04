/**
 * Team Lead Resolution Service
 *
 * Resolves the team lead for a given team.
 * Once team is known, identify who leads that team.
 *
 * Rules:
 * - Team Lead must belong to same organization (via team)
 * - Team Lead must have role = 'team_lead' in team_members
 * - If exactly one: resolve
 * - If none: return NO_TEAM_LEAD (don't invent)
 * - If multiple: return MULTIPLE_TEAM_LEADS (don't arbitrarily choose)
 *
 * IMPORTANT: team_lead_id is stored for reference/accountability only.
 * Authoritative source remains: team -> team_members -> role='team_lead'
 * This allows dynamic team lead changes without updating past tasks.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type TeamLeadResolutionStatus = 'resolved' | 'multiple_leads' | 'no_lead';

export interface TeamLeadCandidate {
  userId: string;
  displayName: string;
  fullName?: string;
  jobTitle?: string;
}

export interface TeamLeadResolutionResult {
  status: TeamLeadResolutionStatus;
  userId?: string; // Set if resolved
  displayName?: string; // Set if resolved
  candidates?: TeamLeadCandidate[]; // Set if multiple_leads
  reason?: string; // Explanation
}

/**
 * Resolve the team lead for a given team.
 *
 * @param supabase - Authenticated Supabase client
 * @param teamId - Team ID
 * @returns Team lead resolution result
 */
export async function getTeamLeadResolution(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamLeadResolutionResult> {
  // Validate input
  if (!teamId) {
    return {
      status: 'no_lead',
      reason: 'No team ID provided',
    };
  }

  try {
    // Fetch all team leads for this team
    const { data: leads, error: leadsError } = await supabase
      .from('team_members')
      .select(
        `
        id,
        user_id,
        role,
        user_profiles!inner(
          id,
          display_name,
          full_name,
          job_title
        )
      `,
      )
      .eq('team_id', teamId)
      .eq('role', 'team_lead');

    if (leadsError) {
      console.error('[team-lead-resolution] Failed to fetch team leads:', leadsError);
      return {
        status: 'no_lead',
        reason: 'Failed to query team leads',
      };
    }

    if (!leads || leads.length === 0) {
      return {
        status: 'no_lead',
        reason: 'Team has no assigned lead',
      };
    }

    // Build candidate list
    const candidates: TeamLeadCandidate[] = [];

    for (const lead of leads) {
      const profiles = lead.user_profiles as Array<{ id: string; display_name: string; full_name: string; job_title: string }>;
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;
      if (!profile) continue;

      candidates.push({
        userId: lead.user_id,
        displayName: profile.display_name || profile.full_name || 'Unknown',
        fullName: profile.full_name,
        jobTitle: profile.job_title,
      });
    }

    if (candidates.length === 0) {
      return {
        status: 'no_lead',
        reason: 'Team has no team lead with valid profile',
      };
    }

    // If exactly one lead, resolve
    if (candidates.length === 1) {
      const lead = candidates[0];
      return {
        status: 'resolved',
        userId: lead.userId,
        displayName: lead.displayName,
        reason: `Team lead: ${lead.displayName}`,
      };
    }

    // Multiple leads: this is unusual but possible
    return {
      status: 'multiple_leads',
      candidates,
      reason: `Team has ${candidates.length} assigned leads; clarification may be needed`,
    };
  } catch (err) {
    console.error('[team-lead-resolution] Unexpected error:', err);
    return {
      status: 'no_lead',
      reason: 'Unexpected error during team lead resolution',
    };
  }
}

/**
 * Get team lead details (if exists).
 * Simpler version that returns null if not found or error occurs.
 *
 * @param supabase - Authenticated Supabase client
 * @param teamId - Team ID
 * @returns Team lead user ID and name, or null
 */
export async function getTeamLeadUser(
  supabase: SupabaseClient,
  teamId: string,
): Promise<{ userId: string; displayName: string } | null> {
  const result = await getTeamLeadResolution(supabase, teamId);

  if (result.status === 'resolved' && result.userId && result.displayName) {
    return {
      userId: result.userId,
      displayName: result.displayName,
    };
  }

  return null;
}

/**
 * Check if a user is a team lead of a specific team.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to check
 * @param teamId - Team ID
 * @returns true if user is team lead of this team
 */
export async function isTeamLead(
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
      .eq('role', 'team_lead')
      .maybeSingle();

    if (error) {
      console.error('[team-lead-resolution] Error checking team lead status:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[team-lead-resolution] Unexpected error:', err);
    return false;
  }
}
