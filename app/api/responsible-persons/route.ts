import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { task_id, name, email, is_followthru_member = false } = body;

    if (!task_id || !name || !email) {
      return NextResponse.json(
        { error: 'task_id, name, and email required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('commitment_responsible_persons')
      .insert({
        task_id,
        name,
        email,
        is_followthru_member,
        user_id: userResult.userId,
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('Create responsible person error:', error);
    return NextResponse.json(
      { error: 'Failed to save responsible person' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = request.nextUrl.searchParams.get('task_id');
    if (!taskId) {
      return NextResponse.json({ error: 'task_id required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('commitment_responsible_persons')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ person: data || null });
  } catch (error) {
    console.error('Get responsible person error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch responsible person' },
      { status: 500 },
    );
  }
}
