import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

import { callGroqForNudge } from '@/lib/groq';

export const dynamic = 'force-dynamic';

export async function POST(

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

    const { id } = params;

    const supabase = createServerClient();

    const { data: task, error } = await supabase

      .from('tasks')

      .select('description, owner, due_date')

      .eq('id', id)

      .eq('user_id', user.userId)

      .maybeSingle();

    if (error || !task) {

      return NextResponse.json(

        { error: 'Task not found.' },

        { status: 404 },

      );

    }

    const message = await callGroqForNudge(task);

    return NextResponse.json({ message });

  } catch (err) {

    console.error('Nudge error:', err);

    const message = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json({ error: message }, { status: 500 });

  }

}
