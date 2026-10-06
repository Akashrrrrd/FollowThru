/**
 * Organization Dashboard Service
 *
 * Provides organization-scoped visibility for Managers.
 *
 * Managers can view:
 * - Organization summary (total, completed, active, blocked, overdue, needs assignment, unassigned)
 * - Per-team breakdown
 * - Drill-down to team-level metrics
 *
 * Authorization:
 * - User must have role 'owner' or 'manager' in their organization
 * - Can only view their own organization
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamMetrics {
  team_id: string;
  team_name: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  needs_assignment_review: number;
  unassigned: number;
  member_count: number;
}

export interface OrganizationTaskMetrics {
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  needs_assignment_review: number;
  unassigned: number;
}

export interface ManagerDashboardData {
  organization_id: string;
  organization_name: string;
  summary: OrganizationTaskMetrics;
  teams: TeamMetrics[];
  timestamp: string;
}

export class OrganizationDashboardService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get dashboard data for organization (with authorization check).
   *
   * @param userId - Authenticated user ID
   * @param organizationId - Organization ID (server-validated)
   * @returns Dashboard data or throws error if not authorized
   */
  async getDashboard(userId: string, organizationId: string): Promise<ManagerDashboardData> {
    // Step 1: Verify user is manager or owner in this organization
    const { data: orgMember, error: memberError } = await this.supabase
      .from('organization_members')
      .select('id, role, organizations!inner(id, name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (memberError || !orgMember) {
      throw new Error('Not authorized to view this organization (must be manager or owner)');
    }

    const organizationList = orgMember.organizations as Array<{ id: string; name: string }>;
    if (!organizationList || organizationList.length === 0) {
      throw new Error('Organization not found');
    }
    const organization = organizationList[0];

    // Step 2: Fetch all teams in organization
    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');

    if (teamsError) {
      console.error('[org-dashboard] Teams query error:', teamsError);
      throw teamsError;
    }

    // Step 3: Fetch all organization tasks
    const { data: tasks, error: tasksError } = await this.supabase
      .from('tasks')
      .select('id, team_id, status, due_date, assigned_to_user_id, needs_assignment_review')
      .eq('organization_id', organizationId)
      .not('status', 'is', null);

    if (tasksError) {
      console.error('[org-dashboard] Tasks query error:', tasksError);
      throw tasksError;
    }

    // Step 4: Calculate organization-wide metrics
    const summary = this.calculateMetrics(tasks || []);

    // Step 5: Batch-fetch all team member counts (eliminates N+1 query pattern)
    // Get all team IDs and fetch member counts in a single aggregated query
    const teamIds = (teams || []).map((t) => t.id);
    const { data: teamMemberCounts, error: memberCountError } = await this.supabase
      .from('team_members')
      .select('team_id')
      .in('team_id', teamIds);

    if (memberCountError) {
      console.error('[org-dashboard] Team members count query error:', memberCountError);
      // Gracefully degrade: use 0 as member count
    }

    // Build a map of team_id -> member count
    const memberCountByTeam = new Map<string, number>();
    (teamMemberCounts || []).forEach((member) => {
      const count = memberCountByTeam.get(member.team_id) ?? 0;
      memberCountByTeam.set(member.team_id, count + 1);
    });

    // Step 6: Build per-team metrics
    const teamMetrics: TeamMetrics[] = [];

    for (const team of teams || []) {
      const teamTasks = (tasks || []).filter((t) => t.team_id === team.id);
      const metrics = this.calculateMetrics(teamTasks);

      teamMetrics.push({
        team_id: team.id,
        team_name: team.name,
        total: metrics.total,
        completed: metrics.completed,
        in_progress: metrics.in_progress,
        blocked: metrics.blocked,
        overdue: metrics.overdue,
        needs_assignment_review: metrics.needs_assignment_review,
        unassigned: metrics.unassigned,
        member_count: memberCountByTeam.get(team.id) ?? 0,
      });
    }

    // Sort teams by name
    teamMetrics.sort((a, b) => a.team_name.localeCompare(b.team_name));

    return {
      organization_id: organizationId,
      organization_name: organization.name,
      summary,
      teams: teamMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get team breakdown for a specific team (for drill-down).
   *
   * @param userId - Authenticated user ID (must be manager/owner)
   * @param organizationId - Organization ID (server-validated)
   * @param teamId - Team ID to drill into
   * @returns Team metrics and member breakdown
   */
  async getTeamDrilldown(
    userId: string,
    organizationId: string,
    teamId: string,
  ): Promise<
    TeamMetrics & {
      members: Array<{
        user_id: string;
        display_name: string;
        full_name?: string;
        total: number;
        completed: number;
        in_progress: number;
        blocked: number;
        overdue: number;
      }>;
    }
  > {
    // Verify authorization
    const { data: orgMember, error: memberError } = await this.supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (memberError || !orgMember) {
      throw new Error('Not authorized');
    }

    // Verify team belongs to org
    const { data: team, error: teamError } = await this.supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('id', teamId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (teamError || !team) {
      throw new Error('Team not found in this organization');
    }

    // Fetch team tasks
    const { data: tasks } = await this.supabase
      .from('tasks')
      .select(
        `
        id,
        assigned_to_user_id,
        status,
        due_date,
        needs_assignment_review,
        user_profiles!assigned_to_user_id(id, display_name, full_name)
      `,
      )
      .eq('team_id', teamId)
      .not('status', 'is', null);

    const metrics = this.calculateMetrics(tasks || []);

    // Build per-member breakdown
    const memberMap = new Map<string, { profile: any; tasks: any[] }>();

    (tasks || []).forEach((task) => {
      if (!task.assigned_to_user_id) return;

      if (!memberMap.has(task.assigned_to_user_id)) {
        const profiles = task.user_profiles as Array<{ id: string; display_name: string; full_name: string }>;
        const profile = profiles && profiles.length > 0 ? profiles[0] : null;
        memberMap.set(task.assigned_to_user_id, {
          profile,
          tasks: [],
        });
      }

      memberMap.get(task.assigned_to_user_id)!.tasks.push(task);
    });

    const members = Array.from(memberMap.entries()).map(([userId, { profile, tasks: memberTasks }]) => {
      const memberMetrics = this.calculateMetrics(memberTasks);
      return {
        user_id: userId,
        display_name: profile?.display_name || 'Unknown',
        full_name: profile?.full_name,
        total: memberMetrics.total,
        completed: memberMetrics.completed,
        in_progress: memberMetrics.in_progress,
        blocked: memberMetrics.blocked,
        overdue: memberMetrics.overdue,
      };
    });

    // Get member count
    const { count: memberCount } = await this.supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    return {
      team_id: teamId,
      team_name: team.name,
      member_count: memberCount ?? 0,
      total: metrics.total,
      completed: metrics.completed,
      in_progress: metrics.in_progress,
      blocked: metrics.blocked,
      overdue: metrics.overdue,
      needs_assignment_review: metrics.needs_assignment_review,
      unassigned: metrics.unassigned,
      members,
    };
  }

  /**
   * Calculate metrics from a task list.
   */
  private calculateMetrics(
    tasks: any[],
  ): Omit<OrganizationTaskMetrics, 'needs_assignment_review'> & { needs_assignment_review: number } {
    const now = new Date();

    let completed = 0;
    let in_progress = 0;
    let blocked = 0;
    let overdue = 0;
    let needs_assignment = 0;
    let unassigned = 0;

    tasks.forEach((task) => {
      // Completed check
      if (task.status === 'done' || task.status === 'completed') {
        completed++;
        return;
      }

      // Unassigned check
      if (!task.assigned_to_user_id) {
        unassigned++;
        return;
      }

      // Needs assignment review check
      if (task.needs_assignment_review) {
        needs_assignment++;
        return;
      }

      // Overdue check (if not completed)
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate < now) {
          overdue++;
          return;
        }
      }

      // Status-based
      if (task.status === 'blocked') {
        blocked++;
      } else if (task.status === 'in_progress' || task.status === 'in progress') {
        in_progress++;
      } else {
        // Default to in_progress if not specified
        in_progress++;
      }
    });

    return {
      total: tasks.length,
      completed,
      in_progress,
      blocked,
      overdue,
      needs_assignment_review: needs_assignment,
      unassigned,
    };
  }
}
