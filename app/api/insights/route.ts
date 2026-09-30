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

    // Fetch all tasks for this user

    const { data: tasks, error: tasksError } = await supabase

      .from('tasks')

      .select('id, status, owner, due_date, meeting_id')

      .eq('user_id', user.userId);

    if (tasksError) {

      return NextResponse.json(

        { error: 'Failed to fetch insights.' },

        { status: 500 },

      );

    }

    const allTasks = tasks ?? [];

    const totalTasks = allTasks.length;

    const doneTasks = allTasks.filter((t) => t.status === 'done' || t.status === 'completed').length;

    const overdueTasks = allTasks.filter((t) => t.status === 'overdue').length;

    const completionRate =

      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Per-meeting stats (most recent 8)

    const { data: meetings, error: meetingsError } = await supabase

      .from('meetings')

      .select('id, title, created_at')

      .eq('user_id', user.userId)

      .order('created_at', { ascending: false })

      .limit(8);

    if (meetingsError) {

      console.error('Insights meetings error:', meetingsError.message);

    }

    const meetingStats = (meetings ?? []).map((m) => {

      const meetingTasks = allTasks.filter((t) => t.meeting_id === m.id);

      const done = meetingTasks.filter((t) => t.status === 'done' || t.status === 'completed').length;

      const overdue = meetingTasks.filter((t) => t.status === 'overdue').length;

      return {

        id: m.id,

        title: m.title,

        created_at: m.created_at,

        done,

        overdue,

        total: meetingTasks.length,

      };

    });

    // Per-owner stats

    const ownerMap = new Map<

      string,

      { owner: string; total: number; done: number }

    >();

    for (const t of allTasks) {

      const entry = ownerMap.get(t.owner) ?? { owner: t.owner, total: 0, done: 0 };

      entry.total += 1;

      if (t.status === 'done' || t.status === 'completed') entry.done += 1;

      ownerMap.set(t.owner, entry);

    }

    const ownerStats = Array.from(ownerMap.values())

      .sort((a, b) => b.total - a.total)

      .map((o) => ({

        ...o,

        completionRate:

          o.total > 0 ? Math.round((o.done / o.total) * 100) : 0,

      }));

    return NextResponse.json({

      summary: {

        totalTasks,

        doneTasks,

        overdueTasks,

        completionRate,

      },

      meetingStats,

      ownerStats,

    });

  } catch (err) {

    console.error('Insights error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
