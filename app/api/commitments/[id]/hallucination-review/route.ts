// app/api/commitments/[id]/hallucination-review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { addHistoryEntry } from '@/lib/history';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  // Works for both Next 14 (plain object) and Next 15+ (Promise).
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: taskId } = await params;

    let body: { action?: string; new_description?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, new_description } = body;
    if (!action || !['approve', 'dismiss', 'rephrase'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('id, description, flagged_for_review, grace_period_ends_at')
      .eq('id', taskId)
      .eq('user_id', user.userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Review task lookup failed:', fetchError);
      return NextResponse.json({ error: 'Failed to look up task' }, { status: 500 });
    }
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Only flagged tasks can be acted on here (prevents deleting normal tasks via this route).
    if (!task.flagged_for_review) {
      return NextResponse.json(
        { error: 'This commitment is no longer pending review.' },
        { status: 409 },
      );
    }

    if (!task.grace_period_ends_at || Date.now() > new Date(task.grace_period_ends_at).getTime()) {
      return NextResponse.json(
        { error: 'The review window has ended. The commitment was kept automatically.' },
        { status: 400 },
      );
    }

    const resolveFlags = () =>
      supabase
        .from('hallucination_flags')
        .update({ resolved: true })
        .eq('task_id', taskId)
        .eq('resolved', false);

    if (action === 'approve') {
      const { error } = await supabase
        .from('tasks')
        .update({ flagged_for_review: false, grace_period_ends_at: null })
        .eq('id', taskId)
        .eq('user_id', user.userId);
      if (error) throw error;

      await resolveFlags();
      return NextResponse.json({ status: 'approved' });
    }

    if (action === 'dismiss') {
      // Remove review markers first so they can never block the task delete.
      await supabase.from('hallucination_flags').delete().eq('task_id', taskId);

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.userId);
      if (error) throw error;

      return NextResponse.json({ status: 'dismissed' });
    }

    // rephrase
    const trimmed = (new_description || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'new_description required for rephrase' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tasks')
      .update({ description: trimmed, flagged_for_review: false, grace_period_ends_at: null })
      .eq('id', taskId)
      .eq('user_id', user.userId);
    if (error) throw error;

    try {
      await addHistoryEntry(
        taskId,
        user.userId,
        'updated',
        task.description || '',
        trimmed,
        'Description rephrased during review',
      );
    } catch (err) {
      console.warn('History entry failed:', err);
    }

    await resolveFlags();
    return NextResponse.json({ status: 'rephrased', new_description: trimmed });
  } catch (error: any) {
    console.error('Hallucination review error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process review' },
      { status: 500 },
    );
  }
}