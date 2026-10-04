/**
 * Team Lead Dashboard Service
 *
 * Provides team-scoped visibility for Team Leads.
 *
 * Team Leads can view:
 * - Team summary (total, completed, active, blocked, overdue, needs assignment, unassigned)
 * - Per-employee breakdown
 * - Individual team member tasks
 *
 * Authorization:
 * - User must be team_lead in the requested team
 * - Team must belong to user's organization
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TeamTaskMetrics {
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  needs_assignment_review: number;
  unassigned: number;
}

export interface TeamMemberSummary {
  user_id: string;
  display_name: string;
  full_name?: string;
  metrics: TeamTaskMetrics;
}

export interface TeamLeadDashboardData {
  team_id: string;
  team_name: string;
  organization_id: string;
  summary: TeamTaskMetrics;
  members: TeamMemberSummary[];
  timestamp: string;
}

export class TeamLeadDashboardService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get dashboard data for a team (with authorization check).
   *
   * @param userId - Authenticated user ID
   * @param teamId - Team ID to fetch dashboard for
   * @returns Dashboard data or throws error if not authorized
   */
  async getDashboard(userId: string, teamId: string): Promise<TeamLeadDashboardData> {
    // Step 1: Verify user is team_lead in this team
    const { data: teamMembership, error: memberError } = await this.supabase
      .from('team_members')
      .select('id, role, teams!inner(id, name, organization_id)')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .eq('role', 'team_lead')
      .maybeSingle();

    if (memberError || !teamMembership) {
      throw new Error('Not authorized to view this team (must be team_lead)');
    }

    const teamList = teamMembership.teams as Array<{ id: string; name: string; organization_id: string }>;
    if (!teamList || teamList.length === 0) {
      throw new Error('Team not found');
    }
    const team = teamList[0];

    // Step 2: Fetch team tasks
    const { data: tasks, error: tasksError } = await this.supabase
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
      .not('status', 'is', null); // Exclude tasks without status

    if (tasksError) {
      console.error('[team-lead-dashboard] Tasks query error:', tasksError);
      throw tasksError;
    }

    // Step 3: Calculate metrics
    const summary = this.calculateMetrics(tasks || []);

    // Step 4: Build per-employee breakdown
    const memberMap = new Map<string, { tasks: any[]; profile: any }>();

    (tasks || []).forEach((task) => {
      const assignedUserId = task.assigned_to_user_id;
      if (!assignedUserId) return; // Skip unassigned

      if (!memberMap.has(assignedUserId)) {
        const profiles = task.user_profiles as Array<{ id: string; display_name: string; full_name: string }>;
        const profile = profiles && profiles.length > 0 ? profiles[0] : null;
        memberMap.set(assignedUserId, {
          tasks: [],
          profile,
        });
      }

      memberMap.get(assignedUserId)!.tasks.push(task);
    });

    // Step 5: Convert to summary format
    const members: TeamMemberSummary[] = Array.from(memberMap.entries()).map(
      ([userId, { tasks: memberTasks, profile }]) => ({
        user_id: userId,
        display_name: profile?.display_name || 'Unknown',
        full_name: profile?.full_name,
        metrics: this.calculateMetrics(memberTasks),
      }),
    );

    return {
      team_id: teamId,
      team_name: team.name,
      organization_id: team.organization_id,
      summary,
      members,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all teams where user is team_lead.
   *
   * @param userId - Authenticated user ID
   * @param organizationId - Organization context (server-validated)
   * @returns List of teams user leads
   */
  async getTeamsWhereLead(
    userId: string,
    organizationId: string,
  ): Promise<
    Array<{
      team_id: string;
      team_name: string;
    }>
  > {
    const { data: teams, error } = await this.supabase
      .from('team_members')
      .select('team_id, teams!inner(id, name, organization_id)')
      .eq('user_id', userId)
      .eq('role', 'team_lead')
      .eq('teams.organization_id', organizationId);

    if (error) {
      console.error('[team-lead-dashboard] Teams query error:', error);
      throw error;
    }

    return (teams || []).map((tm: any) => ({
      team_id: tm.team_id,
      team_name: tm.teams.name,
    }));
  }

  /**
   * Get team member's tasks (for drill-down).
   *
   * @param userId - Team member user ID
   * @param teamId - Team ID (context)
   * @param leadUserId - Authenticated user ID (must be lead in team)
   * @returns List of member's tasks with provenance
   */
  async getMemberTasks(
    userId: string,
    teamId: string,
    leadUserId: string,
  ): Promise<
    Array<{
      id: string;
      description: string;
      status: string;
      due_date: string | null;
      assigned_to_user_id: string;
      needs_assignment_review: boolean;
      source_meeting: { id: string; title: string };
    }>
  > {
    // Verify lead authorization
    const { data: leadCheck, error: leadError } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('user_id', leadUserId)
      .eq('team_id', teamId)
      .eq('role', 'team_lead')
      .maybeSingle();

    if (leadError || !leadCheck) {
      throw new Error('Not authorized to view this team');
    }

    // Fetch member's tasks
    const { data: tasks, error } = await this.supabase
      .from('tasks')
      .select(
        `
        id,
        description,
        status,
        due_date,
        assigned_to_user_id,
        needs_assignment_review,
        meetings!inner(id, title)
      `,
      )
      .eq('assigned_to_user_id', userId)
      .eq('team_id', teamId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('[team-lead-dashboard] Member tasks query error:', error);
      throw error;
    }

    return (tasks || []).map((task: any) => ({
      id: task.id,
      description: task.description,
      status: task.status,
      due_date: task.due_date,
      assigned_to_user_id: task.assigned_to_user_id,
      needs_assignment_review: task.needs_assignment_review,
      source_meeting: {
        id: task.meetings?.id,
        title: task.meetings?.title,
      },
    }));
  }

  /**
   * Calculate metrics from a task list.
   */
  private calculateMetrics(tasks: any[]): TeamTaskMetrics {
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
