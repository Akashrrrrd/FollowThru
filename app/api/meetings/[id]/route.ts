import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

import { updateOverdueTasks } from '@/lib/overdue';

export async function GET(

  req: NextRequest,

  { params }: { params: { id: string } },

) {

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

    const { id } = params;

    const { data: meeting, error: meetingError } = await supabase

      .from('meetings')

      .select('*')

      .eq('id', id)

      .eq('user_id', user.userId)

      .maybeSingle();

    if (meetingError || !meeting) {

      return NextResponse.json(

        { error: 'Meeting not found.' },

        { status: 404 },

      );

    }

    const { data: tasks, error: tasksError } = await supabase

      .from('tasks')

      .select('*')

      .eq('meeting_id', id)

      .eq('user_id', user.userId)

      .order('due_date', { ascending: true, nullsFirst: false });

    if (tasksError) {

      console.error('Failed to fetch tasks:', tasksError.message);

    }

    return NextResponse.json({

      meeting,

      tasks: tasks ?? [],

    });

  } catch (err) {

    console.error('Meeting detail GET error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
