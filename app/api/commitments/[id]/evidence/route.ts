import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = params.id;
    const supabase = createServerClient();

    // Verify task ownership
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', userResult.userId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get all evidence for this task
    const { data: evidence, error } = await supabase
      .from('commitment_evidence')
      .select('id, quote, timestamp_in_transcript, source_url, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ evidence: evidence || [] });
  } catch (error) {
    console.error('Get evidence error:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}
