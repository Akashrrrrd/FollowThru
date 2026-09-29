import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

import { updateOverdueTasks } from '@/lib/overdue';

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

    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');

    const owner = searchParams.get('owner');

    const meetingId = searchParams.get('meeting_id');

    const myCommitments = searchParams.get('my_commitments') === 'true';

    let query = supabase

      .from('tasks')

      .select('*')

      .eq('user_id', user.userId)

      .order('due_date', { ascending: true, nullsFirst: false });

    if (status && status !== 'all') {

      query = query.eq('status', status);

    }

    if (owner && owner !== 'all') {

      query = query.eq('owner', owner);

    }

    if (meetingId) {

      query = query.eq('meeting_id', meetingId);

    }

    // Filter to only tasks owned by current user (owner_user_id === user.userId)

    if (myCommitments) {

      query = query.eq('owner_user_id', user.userId);

    }

    const { data: tasks, error } = await query;

    if (error) {

      return NextResponse.json(

        { error: 'Failed to fetch tasks.' },

        { status: 500 },

      );

    }

    return NextResponse.json({ tasks: tasks ?? [] });

  } catch (err) {

    console.error('Tasks GET error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}

export async function POST(req: NextRequest) {

  try {

    const user = await getUserFromRequest(req);

    if (!user) {

      return NextResponse.json(

        { error: 'You must be signed in.' },

        { status: 401 },

      );

    }

    const body = await req.json();

    const { meeting_id, description, owner, due_date } = body as {

      meeting_id?: string;

      description?: string;

      owner?: string;

      due_date?: string | null;

    };

    if (!meeting_id || !description || !description.trim() || !owner || !owner.trim()) {

      return NextResponse.json(

        { error: 'Meeting ID, description, and owner are required.' },

        { status: 400 },

      );

    }

    const supabase = createServerClient();

    // Verify the meeting belongs to this user

    const { data: meeting, error: meetingError } = await supabase

      .from('meetings')

      .select('id')

      .eq('id', meeting_id)

      .eq('user_id', user.userId)

      .maybeSingle();

    if (meetingError || !meeting) {

      return NextResponse.json(

        { error: 'Meeting not found.' },

        { status: 404 },

      );

    }

    const { data: task, error } = await supabase

      .from('tasks')

      .insert({

        meeting_id,

        user_id: user.userId,

        description: description.trim(),

        owner: owner.trim(),

        due_date: due_date || null,

        source_quote: 'Manually added',

      })

      .select()

      .single();

    if (error || !task) {

      return NextResponse.json(

        { error: 'Failed to create task.' },

        { status: 500 },

      );

    }

    return NextResponse.json({ task });

  } catch (err) {

    console.error('Task POST error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
