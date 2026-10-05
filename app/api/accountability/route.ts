import { NextRequest, NextResponse } from 'next/server';

import {
  createServerClient,
  getUserFromRequest,
} from '@/lib/supabase-server';

import {
  getUserOrganizationContext,
} from '@/lib/organization-context';

import {
  getUserTeams,
} from '@/lib/team-authorization';

import {
  updateOverdueTasks,
} from '@/lib/overdue';

import {
  isOverdue,
} from '@/lib/lifecycle';

import {
  getAccountabilityStatus,
  type AccountabilityMetrics,
} from '@/lib/accountability-status';

export const dynamic = 'force-dynamic';

type AccountabilityTask = {
  id: string;
  user_id: string | null;
  assigned_to_user_id: string | null;
  owner_user_id: string | null;
  owner: string | null;
  team_id: string | null;
  status: string | null;
  due_date: string | null;
  escalation_level?: number;
};

type OwnerMetric = {
  owner: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  completion_rate: number;
  status?: string; // ON_TRACK, AT_RISK, NEEDS_ATTENTION
};

type TeamMetric = {
  team_id: string;
  team_name: string;
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  completion_rate: number;
  status?: string; // ON_TRACK, AT_RISK, NEEDS_ATTENTION
};

type EscalationRow = {
  task_id: string;
  status: string;
  escalation_level: number;
  created_at: string;
};

function isCompleted(status: string | null) {
  return status === 'completed' || status === 'done';
}

function calculateRate(
  completed: number,
  total: number,
) {
  if (total === 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

function buildOwnerMetrics(
  tasks: AccountabilityTask[],
  escalationsByTaskId: Map<string, EscalationRow>,
): OwnerMetric[] {
  const map = new Map<
    string,
    {
      owner: string;
      total: number;
      completed: number;
      in_progress: number;
      blocked: number;
      overdue: number;
      escalation_level: number;
      recent_escalation_7d: number;
    }
  >();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const task of tasks) {
    const owner =
      typeof task.owner === 'string' &&
      task.owner.trim().length > 0
        ? task.owner.trim()
        : 'Unassigned';

    const existing = map.get(owner);
    const escalation = escalationsByTaskId.get(task.id);

    if (!existing) {
      const recentEscalation =
        escalation && new Date(escalation.created_at) > sevenDaysAgo ? 1 : 0;

      map.set(owner, {
        owner,
        total: 1,
        completed: isCompleted(task.status) ? 1 : 0,
        in_progress:
          task.status === 'in_progress' ? 1 : 0,
        blocked:
          task.status === 'blocked' ? 1 : 0,
        overdue: isOverdue({ due_date: task.due_date, status: task.status } as any) ? 1 : 0,
        escalation_level: escalation?.escalation_level ?? 0,
        recent_escalation_7d: recentEscalation,
      });

      continue;
    }

    existing.total += 1;

    if (isCompleted(task.status)) {
      existing.completed += 1;
    }

    if (task.status === 'in_progress') {
      existing.in_progress += 1;
    }

    if (task.status === 'blocked') {
      existing.blocked += 1;
    }

    if (isOverdue({ due_date: task.due_date, status: task.status } as any)) {
      existing.overdue += 1;
    }

    // Track highest escalation level
    if (escalation && escalation.escalation_level > existing.escalation_level) {
      existing.escalation_level = escalation.escalation_level;
    }

    // Track recent escalation
    if (escalation && new Date(escalation.created_at) > sevenDaysAgo) {
      existing.recent_escalation_7d = 1;
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      owner: item.owner,
      total: item.total,
      completed: item.completed,
      in_progress: item.in_progress,
      blocked: item.blocked,
      overdue: item.overdue,
      completion_rate: calculateRate(
        item.completed,
        item.total,
      ),
      status: getAccountabilityStatus({
        total: item.total,
        completed: item.completed,
        overdue: item.overdue,
        completion_rate: calculateRate(item.completed, item.total),
        escalation_level: item.escalation_level,
        recent_escalation_7d: item.recent_escalation_7d,
      }),
    }))
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }

      return a.owner.localeCompare(b.owner);
    });
}

function buildTeamMetrics(
  tasks: AccountabilityTask[],
  teams: Array<{
    id: string;
    name: string;
  }>,
  escalationsByTaskId: Map<string, EscalationRow>,
): TeamMetric[] {
  const map = new Map<
    string,
    {
      team_id: string;
      team_name: string;
      total: number;
      completed: number;
      in_progress: number;
      blocked: number;
      overdue: number;
      escalation_level: number;
      recent_escalation_7d: number;
    }
  >();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Initialize every team so teams with zero
  // commitments are still returned.
  for (const team of teams) {
    map.set(team.id, {
      team_id: team.id,
      team_name: team.name,
      total: 0,
      completed: 0,
      in_progress: 0,
      blocked: 0,
      overdue: 0,
      escalation_level: 0,
      recent_escalation_7d: 0,
    });
  }

  for (const task of tasks) {
    if (!task.team_id) {
      continue;
    }

    const existing = map.get(task.team_id);

    if (!existing) {
      continue;
    }

    const escalation = escalationsByTaskId.get(task.id);

    existing.total += 1;

    if (isCompleted(task.status)) {
      existing.completed += 1;
    }

    if (task.status === 'in_progress') {
      existing.in_progress += 1;
    }

    if (task.status === 'blocked') {
      existing.blocked += 1;
    }

    if (isOverdue({ due_date: task.due_date, status: task.status } as any)) {
      existing.overdue += 1;
    }

    // Track highest escalation level in team
    if (escalation && escalation.escalation_level > existing.escalation_level) {
      existing.escalation_level = escalation.escalation_level;
    }

    // Track recent escalation
    if (escalation && new Date(escalation.created_at) > sevenDaysAgo) {
      existing.recent_escalation_7d = 1;
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      team_id: item.team_id,
      team_name: item.team_name,
      total: item.total,
      completed: item.completed,
      in_progress: item.in_progress,
      blocked: item.blocked,
      overdue: item.overdue,
      completion_rate: calculateRate(
        item.completed,
        item.total,
      ),
      status: getAccountabilityStatus({
        total: item.total,
        completed: item.completed,
        overdue: item.overdue,
        completion_rate: calculateRate(item.completed, item.total),
        escalation_level: item.escalation_level,
        recent_escalation_7d: item.recent_escalation_7d,
      }),
    }))
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }

      return a.team_name.localeCompare(b.team_name);
    });
}

export async function GET(req: NextRequest) {
  try {
    /*
     * -------------------------------------------------------
     * AUTHENTICATION
     * -------------------------------------------------------
     */

    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        {
          error: 'You must be signed in.',
        },
        {
          status: 401,
        },
      );
    }

    const supabase = createServerClient();

    /*
     * -------------------------------------------------------
     * ORGANIZATION CONTEXT
     * -------------------------------------------------------
     */

    const orgContext =
      await getUserOrganizationContext(
        supabase,
        user.userId,
      );

    if (!orgContext) {
      return NextResponse.json(
        {
          error:
            'User has no organization membership',
        },
        {
          status: 403,
        },
      );
    }

    /*
     * -------------------------------------------------------
     * KEEP OVERDUE STATUS UP TO DATE
     * -------------------------------------------------------
     */

    await updateOverdueTasks(user.userId);

    /*
     * -------------------------------------------------------
     * GET USER TEAMS
     * -------------------------------------------------------
     */

    const userTeams = await getUserTeams(
      supabase,
      user.userId,
      orgContext.organizationId,
    );

    const teamIds = userTeams.map(
      (team) => team.teamId,
    );

    /*
     * -------------------------------------------------------
     * GET ORGANIZATION TEAMS
     * -------------------------------------------------------
     */

    const {
      data: teams,
      error: teamsError,
    } = await supabase
      .from('teams')
      .select('id, name')
      .eq(
        'organization_id',
        orgContext.organizationId,
      )
      .order('name', {
        ascending: true,
      });

    if (teamsError) {
      console.error(
        'Accountability teams error:',
        teamsError,
      );

      return NextResponse.json(
        {
          error:
            'Failed to fetch organization teams.',
        },
        {
          status: 500,
        },
      );
    }

    /*
     * -------------------------------------------------------
     * GET TASKS
     * -------------------------------------------------------
     *
     * Managers/owners:
     *   See all organization tasks.
     *
     * Members:
     *   See tasks they created,
     *   tasks assigned to them,
     *   or tasks belonging to their teams.
     *
     * This mirrors the access model already used
     * by /api/tasks.
     */

    let query = supabase
      .from('tasks')
      .select(
        `
          id,
          user_id,
          assigned_to_user_id,
          owner_user_id,
          owner,
          team_id,
          status,
          due_date
        `,
      )
      .eq(
        'organization_id',
        orgContext.organizationId,
      );

    const isManagerOrOwner =
      orgContext.role === 'owner' ||
      orgContext.role === 'manager';

    if (!isManagerOrOwner) {
      if (teamIds.length > 0) {
        query = query.or(
          [
            `user_id.eq.${user.userId}`,
            `assigned_to_user_id.eq.${user.userId}`,
            `team_id.in.(${teamIds.join(',')})`,
          ].join(','),
        );
      } else {
        query = query.or(
          [
            `user_id.eq.${user.userId}`,
            `assigned_to_user_id.eq.${user.userId}`,
          ].join(','),
        );
      }
    }

    const {
      data: tasks,
      error: tasksError,
    } = await query;

    if (tasksError) {
      console.error(
        'Accountability tasks error:',
        tasksError,
      );

      return NextResponse.json(
        {
          error:
            'Failed to fetch accountability data.',
        },
        {
          status: 500,
        },
      );
    }

    const accountabilityTasks =
      (tasks ?? []) as AccountabilityTask[];

    /*
     * -------------------------------------------------------
     * GET ESCALATION STATE FOR TASKS
     * -------------------------------------------------------
     * Fetch escalation_level for each task to determine
     * accountability status.
     */

    const taskIds = accountabilityTasks.map(t => t.id);
    
    let escalationsByTaskId = new Map<string, EscalationRow>();
    
    if (taskIds.length > 0) {
      const { data: escalations, error: escalationError } = await supabase
        .from('escalation_state')
        .select('task_id, escalation_level')
        .in('task_id', taskIds);

      if (escalationError) {
        console.error(
          'Accountability escalation error:',
          escalationError,
        );
        // Continue without escalation data rather than failing
      } else if (escalations) {
        escalationsByTaskId = new Map(
          escalations.map((e: any) => [
            e.task_id,
            {
              task_id: e.task_id,
              escalation_level: e.escalation_level,
              status: 'active',
              created_at: new Date().toISOString(),
            } as EscalationRow,
          ]),
        );
      }
    }

    /*
     * -------------------------------------------------------
     * ORGANIZATION-LEVEL METRICS
     * -------------------------------------------------------
     */

    const total = accountabilityTasks.length;

    const completed =
      accountabilityTasks.filter((task) =>
        isCompleted(task.status),
      ).length;

    const inProgress =
      accountabilityTasks.filter(
        (task) =>
          task.status === 'in_progress',
      ).length;

    const blocked =
      accountabilityTasks.filter(
        (task) => task.status === 'blocked',
      ).length;

    const overdue =
      accountabilityTasks.filter((task) =>
        isOverdue({ due_date: task.due_date, status: task.status } as any),
      ).length;

    const open =
      accountabilityTasks.filter(
        (task) =>
          task.status === 'open',
      ).length;

    const completionRate =
      calculateRate(completed, total);

    // Calculate organization status
    const orgStatus = getAccountabilityStatus({
      total,
      completed,
      overdue,
      completion_rate: completionRate,
      escalation_level: Math.max(
        ...Array.from(escalationsByTaskId.values()).map(e => e.escalation_level),
        0,
      ),
    });

    /*
     * -------------------------------------------------------
     * OWNER METRICS
     * -------------------------------------------------------
     */

    const ownerMetrics =
      buildOwnerMetrics(
        accountabilityTasks,
        escalationsByTaskId,
      );

    /*
     * -------------------------------------------------------
     * TEAM METRICS
     * -------------------------------------------------------
     */

    const teamMetrics =
      buildTeamMetrics(
        accountabilityTasks,
        (teams ?? []).map((team) => ({
          id: team.id,
          name: team.name,
        })),
        escalationsByTaskId,
      );

    /*
     * -------------------------------------------------------
     * CURRENT USER METRICS
     * -------------------------------------------------------
     */

    const myTasks =
      accountabilityTasks.filter(
        (task) =>
          task.user_id === user.userId ||
          task.assigned_to_user_id ===
            user.userId ||
          task.owner_user_id ===
            user.userId,
      );

    const myTotal = myTasks.length;

    const myCompleted =
      myTasks.filter((task) =>
        isCompleted(task.status),
      ).length;

    const myInProgress =
      myTasks.filter(
        (task) =>
          task.status === 'in_progress',
      ).length;

    const myBlocked =
      myTasks.filter(
        (task) =>
          task.status === 'blocked',
      ).length;

    const myOverdue =
      myTasks.filter((task) =>
        isOverdue({ due_date: task.due_date, status: task.status } as any),
      ).length;

    const myCompletionRate = calculateRate(
      myCompleted,
      myTotal,
    );

    // Get my highest escalation level
    const myMaxEscalation = Math.max(
      ...myTasks
        .map(t => escalationsByTaskId.get(t.id)?.escalation_level ?? 0),
      0,
    );

    const myStatus = getAccountabilityStatus({
      total: myTotal,
      completed: myCompleted,
      overdue: myOverdue,
      completion_rate: myCompletionRate,
      escalation_level: myMaxEscalation,
    });

    /*
     * -------------------------------------------------------
     * RESPONSE
     * -------------------------------------------------------
     */

    return NextResponse.json({
      organization: {
        id: orgContext.organizationId,
        role: orgContext.role,
      },

      summary: {
        total,
        completed,
        in_progress: inProgress,
        blocked,
        overdue,
        open,
        completion_rate: completionRate,
      },

      accountability_status: {
        organization: orgStatus,
        my_status: myStatus,
      },

      mine: {
        total: myTotal,
        completed: myCompleted,
        in_progress: myInProgress,
        blocked: myBlocked,
        overdue: myOverdue,
        completion_rate: myCompletionRate,
      },

      owners: ownerMetrics,

      teams: teamMetrics,

      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      'Accountability GET error:',
      err,
    );

    return NextResponse.json(
      {
        error:
          'An unexpected error occurred.',
      },
      {
        status: 500,
      },
    );
  }
}