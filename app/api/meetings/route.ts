import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

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

    await updateOverdueTasks(user.userId);

    const supabase = createServerClient();

    const { data: meetings, error } = await supabase

      .from('meetings')

      .select('*')

      .eq('user_id', user.userId)

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
