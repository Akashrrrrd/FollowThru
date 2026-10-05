/**
 * Team access resolution.
 *
 * Resolves the organization FROM THE TEAM (not from "the user's first organization"),
 * then verifies the user belongs to that organization. This is correct for users who
 * belong to several organizations (e.g. their auto-created personal org plus the org
 * they were invited into).
 *
 * Security: organization is read from the database, never from the request.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { OrganizationRole, TeamRole } from '@/lib/team-authorization';

export interface TeamAccess {
  teamId: string;
  organizationId: string;
  orgRole: OrganizationRole;
  teamRole: TeamRole | null;
  /** Org owners/managers, or the lead of this specific team */
  canManage: boolean;
}

/**
 * Returns null when the team doesn't exist OR the user isn't in the team's organization.
 * Callers should answer 404 in both cases so team existence isn't leaked across orgs.
 */
export async function getTeamAccess(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<TeamAccess | null> {
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, organization_id')
    .eq('id', teamId)
    .maybeSingle();

  if (teamError) {
    console.error('[getTeamAccess] Failed to load team:', teamError);
    return null;
  }
  if (!team) return null;

  const { data: orgMember, error: orgError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', team.organization_id)
    .maybeSingle();

  if (orgError) {
    console.error('[getTeamAccess] Failed to load org membership:', orgError);
    return null;
  }
  if (!orgMember) return null;

  const { data: teamMember, error: teamMemberError } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (teamMemberError) {
    console.error('[getTeamAccess] Failed to load team membership:', teamMemberError);
  }

  const orgRole = orgMember.role as OrganizationRole;
  const teamRole = (teamMember?.role as TeamRole | undefined) ?? null;

  return {
    teamId,
    organizationId: team.organization_id,
    orgRole,
    teamRole,
    canManage: orgRole === 'owner' || orgRole === 'manager' || teamRole === 'team_lead',
  };
}