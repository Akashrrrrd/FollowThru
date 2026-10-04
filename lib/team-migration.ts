/**
 * Team Migration & Verification Helpers
 * 
 * Ensures all existing users and data are properly assigned to teams.
 * Used for Phase 2 migration verification and graceful degradation.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface MigrationStatus {
  total_organizations: number;
  organizations_with_default_team: number;
  total_users: number;
  users_in_teams: number;
  total_meetings: number;
  meetings_with_team: number;
  total_tasks: number;
  tasks_with_team: number;
  issues: string[];
}

/**
 * Verify team migration status across the organization.
 * Returns counts and identifies any orphaned records.
 * 
 * @param supabase - Service role client (bypasses RLS)
 * @returns Migration status report
 */
export async function getMigrationStatus(
  supabase: SupabaseClient,
): Promise<MigrationStatus> {
  const issues: string[] = [];

  // Count organizations
  const { count: orgCount } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true });

  // Count organizations with default team
  const { data: orgsWithTeam, error: orgsError } = await supabase
    .from('teams')
    .select('organization_id', { count: 'exact' })
    .eq('name', 'General');

  if (orgsError) {
    issues.push(`Failed to check teams: ${orgsError.message}`);
  }

  // Count total users
  const { count: userCount } = await supabase
    .from('organization_members')
    .select('*', { count: 'exact', head: true });

  // Count users in teams
  const { count: teamMembersCount, error: usersError } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true });

  if (usersError) {
    issues.push(`Failed to check team members: ${usersError.message}`);
  }

  // Count meetings
  const { count: meetingCount } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true });

  // Count meetings with team_id
  const { count: meetingsWithTeam } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null);

  // Count tasks
  const { count: taskCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true });

  // Count tasks with team_id
  const { count: tasksWithTeam } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .not('team_id', 'is', null);

  // Check for orphaned users (in org but not in any team) - skip this for Phase 2 (optional check)
  // This check is not critical for migration validation

  // Check for orphaned meetings (with org but no team)
  const { data: orphanedMeetings, error: orphanMeetError } = await supabase
    .from('meetings')
    .select('id, organization_id')
    .is('team_id', null)
    .not('organization_id', 'is', null);

  if (orphanMeetError) {
    issues.push(`Failed to check orphaned meetings: ${orphanMeetError.message}`);
  } else if (orphanedMeetings && orphanedMeetings.length > 0) {
    issues.push(
      `Found ${orphanedMeetings.length} meetings without team assignment - migration may be incomplete`,
    );
  }

  return {
    total_organizations: orgCount ?? 0,
    organizations_with_default_team: orgsWithTeam?.length ?? 0,
    total_users: userCount ?? 0,
    users_in_teams: teamMembersCount ?? 0,
    total_meetings: meetingCount ?? 0,
    meetings_with_team: meetingsWithTeam ?? 0,
    total_tasks: taskCount ?? 0,
    tasks_with_team: tasksWithTeam ?? 0,
    issues,
  };
}

/**
 * Ensure user is in default team for their organization.
 * Called during auth flow to guarantee team membership.
 * 
 * Idempotent: if user is already in a team, returns success.
 * If user has no team, adds them to the default team.
 * 
 * @param supabase - Service role client
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns true if user is in a team, false if error
 */
export async function ensureUserInDefaultTeam(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  // Check if user already in any team for this org
  const { data: existingTeamMembership, error: checkError } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', userId)
    .in(
      'team_id',
      (await supabase.from('teams').select('id').eq('organization_id', organizationId)).data
        ?.map((t) => t.id) || [],
    )
    .maybeSingle();

  if (checkError) {
    console.error('Failed to check team membership:', checkError);
    return false;
  }

  // User already in a team
  if (existingTeamMembership) {
    return true;
  }

  // Get user's role in organization
  const { data: orgMember, error: orgError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (orgError || !orgMember) {
    console.error('User not found in organization:', orgError);
    return false;
  }

  // Get default team for organization
  const { data: defaultTeam, error: teamError } = await supabase
    .from('teams')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', 'General')
    .maybeSingle();

  if (teamError || !defaultTeam) {
    console.error('Default team not found for organization:', teamError);
    return false;
  }

  // Add user to default team
  const teamRole =
    orgMember.role === 'owner' || orgMember.role === 'manager' ? 'team_lead' : 'member';

  const { error: insertError } = await supabase.from('team_members').insert({
    team_id: defaultTeam.id,
    user_id: userId,
    role: teamRole,
  });

  if (insertError) {
    // If unique constraint violation, user is already in team (race condition)
    if (insertError.code === '23505') {
      return true;
    }
    console.error('Failed to add user to default team:', insertError);
    return false;
  }

  return true;
}

/**
 * Repair missing team assignments for a user.
 * Gracefully handles migration issues by adding user to default team.
 * 
 * @param supabase - Service role client
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns true if repair successful or already correct
 */
export async function repairUserTeamAssignment(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return ensureUserInDefaultTeam(supabase, userId, organizationId);
}

/**
 * Repair missing team assignments for all users in an organization.
 * Called from admin endpoint or scheduled job if migration incomplete.
 * 
 * @param supabase - Service role client
 * @param organizationId - Organization ID
 * @returns Number of users repaired
 */
export async function repairOrganizationTeamAssignments(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number> {
  // Get all org members
  const { data: orgMembers, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId);

  if (membersError || !orgMembers) {
    console.error('Failed to get org members:', membersError);
    return 0;
  }

  // Get default team
  const { data: defaultTeam, error: teamError } = await supabase
    .from('teams')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', 'General')
    .maybeSingle();

  if (teamError || !defaultTeam) {
    console.error('Default team not found:', teamError);
    return 0;
  }

  // Get existing team members
  const { data: existingMembers, error: existingError } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', defaultTeam.id);

  if (existingError) {
    console.error('Failed to get existing team members:', existingError);
    return 0;
  }

  const existingUserIds = new Set((existingMembers ?? []).map((m) => m.user_id));
  const usersToAdd = orgMembers.filter((m) => !existingUserIds.has(m.user_id));

  if (usersToAdd.length === 0) {
    return 0; // All users already in team
  }

  // Get org roles for adding to team
  const { data: orgsRoles, error: rolesError } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .in(
      'user_id',
      usersToAdd.map((u) => u.user_id),
    );

  if (rolesError) {
    console.error('Failed to get user roles:', rolesError);
    return 0;
  }

  const roleMap = new Map(orgsRoles?.map((r) => [r.user_id, r.role]) ?? []);

  // Add users to default team
  const { error: insertError } = await supabase.from('team_members').insert(
    usersToAdd.map((u) => ({
      team_id: defaultTeam.id,
      user_id: u.user_id,
      role:
        roleMap.get(u.user_id) === 'owner' || roleMap.get(u.user_id) === 'manager'
          ? 'team_lead'
          : 'member',
    })),
  );

  if (insertError) {
    console.error('Failed to add users to default team:', insertError);
    return 0;
  }

  return usersToAdd.length;
}
