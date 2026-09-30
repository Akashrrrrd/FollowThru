import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

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

    // Fetch all open/overdue tasks from the user's other meetings

    const { data: tasks, error } = await supabase

      .from('tasks')

      .select(`

        *,

        meetings!inner (title)

      `)

      .eq('user_id', user.userId)

      .in('status', ['open', 'overdue'])

      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {

      return NextResponse.json(

        { error: 'Failed to fetch carried-over tasks.' },

        { status: 500 },

      );

    }

    const carriedOver = (tasks ?? []).map((t) => ({

      ...t,

      meeting_title: (t.meetings as unknown as { title: string }).title,

    }));

    return NextResponse.json({ tasks: carriedOver });

  } catch (err) {

    console.error('Carry-forward error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
