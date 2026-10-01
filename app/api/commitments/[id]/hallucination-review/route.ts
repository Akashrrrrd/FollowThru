import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = params.id;
    const body = await request.json();
    const { action, new_description } = body;

    if (!action || !['approve', 'dismiss', 'rephrase'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get the task and verify ownership
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userResult.userId)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check grace period hasn't expired
    if (task.grace_period_ends_at) {
      const now = new Date();
      const gracePeriodEnd = new Date(task.grace_period_ends_at);
      if (now > gracePeriodEnd) {
        return NextResponse.json(
          { error: 'Grace period has expired. Action cannot be taken.' },
          { status: 400 },
        );
      }
    }

    if (action === 'approve') {
      // Mark as no longer flagged
      await supabase
        .from('tasks')
        .update({
          flagged_for_review: false,
          grace_period_ends_at: null,
        })
        .eq('id', taskId);

      // Mark hallucination flag as resolved
      await supabase
        .from('hallucination_flags')
        .update({ resolved: true })
        .eq('task_id', taskId)
        .eq('resolved', false);

      return NextResponse.json({ status: 'approved' });
    }

    if (action === 'dismiss') {
      // Delete the task
      await supabase.from('tasks').delete().eq('id', taskId);

      // Mark hallucination flag as resolved
      await supabase
        .from('hallucination_flags')
        .update({ resolved: true })
        .eq('task_id', taskId)
        .eq('resolved', false);

      return NextResponse.json({ status: 'dismissed' });
    }

    if (action === 'rephrase') {
      if (!new_description || new_description.trim().length === 0) {
        return NextResponse.json(
          { error: 'new_description required for rephrase' },
          { status: 400 },
        );
      }

      // Update the task description
      await supabase
        .from('tasks')
        .update({
          description: new_description,
          flagged_for_review: false,
          grace_period_ends_at: null,
        })
        .eq('id', taskId);

      // Mark hallucination flag as resolved
      await supabase
        .from('hallucination_flags')
        .update({ resolved: true })
        .eq('task_id', taskId)
        .eq('resolved', false);

      return NextResponse.json({ status: 'rephrased', new_description });
    }
  } catch (error) {
    console.error('Hallucination review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process review' },
      { status: 500 },
    );
  }
}
