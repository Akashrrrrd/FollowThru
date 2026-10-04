import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeams } from '@/lib/team-authorization';
import { updateOverdueTasks } from '@/lib/overdue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  try {

    const user = await getUserFromRequest(req);

    if (!user) {

      return NextResponse.json(

        { error: 'You must be signed in.' },

        { status: 401 },

      );

    }

    const supabase = createServerClient();
    
    // Phase 1: Get user's organization context
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    // Phase 2: Get user's teams
    const userTeams = await getUserTeams(supabase, user.userId, orgContext.organizationId);
    const teamIds = userTeams.map((t) => t.teamId);

    await updateOverdueTasks(user.userId);

    // Query meetings: RLS will filter by organization_members membership
    // Phase 2: Also filter by teams user belongs to
    let query = supabase

      .from('meetings')

      .select('*')

      .eq('user_id', user.userId)
      .eq('organization_id', orgContext.organizationId);
    
    // If user is in teams, also show meetings from those teams
    if (teamIds.length > 0) {
      query = query.or(`team_id.in.(${teamIds.join(',')})`);
    }

    const { data: meetings, error } = await query
      .order('created_at', { ascending: false });

    if (error) {

      return NextResponse.json(

        { error: 'Failed to fetch meetings.' },

        { status: 500 },

      );

    }

    if (!meetings || meetings.length === 0) {

      return NextResponse.json({ meetings: [] });

    }

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

      // Count both 'done' (legacy) and 'completed' (Phase 2 lifecycle)
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

    return NextResponse.json({ meetings: meetingsWithStats });

  } catch (err) {

    console.error('Meetings GET error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
