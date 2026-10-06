import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeams } from '@/lib/team-authorization';
import { updateOverdueTasks } from '@/lib/overdue';
import { successResponse, unauthorized, validationError, internalError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();

    // Get organization context
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return validationError('User has no organization membership');
    }

    // Get user's teams
    const userTeams = await getUserTeams(supabase, user.userId, orgContext.organizationId);
    const teamIds = userTeams.map((t) => t.teamId);

    await updateOverdueTasks(user.userId);

    // Query meetings
    let query = supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.userId)
      .eq('organization_id', orgContext.organizationId);

    if (teamIds.length > 0) {
      query = query.or(`team_id.in.(${teamIds.join(',')})`);
    }

    const { data: meetings, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return internalError('Failed to fetch meetings');
    }

    if (!meetings || meetings.length === 0) {
      return successResponse([]);
    }

    // Get task stats for each meeting
    const meetingIds = meetings.map((m) => m.id);
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('meeting_id, status')
      .in('meeting_id', meetingIds);

    if (tasksError) {
      console.error('Failed to fetch task counts:', tasksError.message);
    }

    const taskMap = new Map<string, { total: number; done: number }>();
    for (const t of tasks ?? []) {
      const entry = taskMap.get(t.meeting_id) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (t.status === 'done' || t.status === 'completed') entry.done += 1;
      taskMap.set(t.meeting_id, entry);
    }

    const meetingsWithStats = meetings.map((m) => {
      const stats = taskMap.get(m.id) ?? { total: 0, done: 0 };
      return {
        ...m,
        total_tasks: stats.total,
        done_tasks: stats.done,
      };
    });

    return successResponse(meetingsWithStats);
  } catch (err) {
    console.error('Meetings GET error:', err);
    return internalError('An unexpected error occurred');
  }
}
