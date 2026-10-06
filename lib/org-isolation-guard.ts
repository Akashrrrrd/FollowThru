/**
 * Organization Isolation Guard
 *
 * Centralized validation to ensure cross-organization data leaks are impossible.
 * These functions verify that team_ids, meeting_ids, etc. belong to the user's organization
 * BEFORE any query is executed.
 *
 * Pattern:
 * 1. Get user's org context
 * 2. Verify all IDs belong to that org (explicit check)
 * 3. Execute query with org_id constraint (defense in depth)
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verify that a team_id belongs to a specific organization
 *
 * @throws Error if team does not belong to org
 */
export async function verifyTeamBelongsToOrg(
  supabase: SupabaseClient,
  teamId: string,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify team: ${error.message}`);
  }

  if (!data) {
    throw new Error('Team not found in your organization (potential cross-org access attempt)');
  }
}

/**
 * Verify that multiple team_ids all belong to a specific organization
 *
 * @throws Error if any team does not belong to org
 */
export async function verifyTeamsBelongToOrg(
  supabase: SupabaseClient,
  teamIds: string[],
  organizationId: string,
): Promise<void> {
  if (teamIds.length === 0) return;

  const { data, error, count } = await supabase
    .from('teams')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .in('id', teamIds);

  if (error) {
    throw new Error(`Failed to verify teams: ${error.message}`);
  }

  if (count !== teamIds.length) {
    throw new Error(
      `Some teams not found in your organization (potential cross-org access attempt)`,
    );
  }
}

/**
 * Verify that a meeting_id belongs to a specific organization
 *
 * @throws Error if meeting does not belong to org
 */
export async function verifyMeetingBelongsToOrg(
  supabase: SupabaseClient,
  meetingId: string,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('meetings')
    .select('id')
    .eq('id', meetingId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify meeting: ${error.message}`);
  }

  if (!data) {
    throw new Error('Meeting not found in your organization (potential cross-org access attempt)');
  }
}

/**
 * Verify that all commitments belong to a specific organization
 *
 * @throws Error if any commitment does not belong to org
 */
export async function verifyCommitmentsBelongToOrg(
  supabase: SupabaseClient,
  commitmentIds: string[],
  organizationId: string,
): Promise<void> {
  if (commitmentIds.length === 0) return;

  const { data, error, count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .in('id', commitmentIds);

  if (error) {
    throw new Error(`Failed to verify commitments: ${error.message}`);
  }

  if (count !== commitmentIds.length) {
    throw new Error(
      `Some commitments not found in your organization (potential cross-org access attempt)`,
    );
  }
}

/**
 * Verify that user belongs to an organization
 *
 * @throws Error if user does not belong to org
 */
export async function verifyUserBelongsToOrg(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify membership: ${error.message}`);
  }

  if (!data) {
    throw new Error('Not a member of this organization');
  }
}

/**
 * Verify that user is a team lead for a specific team
 *
 * @throws Error if user is not a team lead
 */
export async function verifyUserIsTeamLead(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .eq('role', 'team_lead')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify team lead role: ${error.message}`);
  }

  if (!data) {
    throw new Error('You do not have team lead permissions for this team');
  }
}
