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
    const { data: task } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('user_id', userResult.userId)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get blockers for this task
    const { data: blockers, error } = await supabase
      .from('task_blockers')
      .select('id, blocker_task_id, blocked_task_id, reason, tasks!task_blockers_blocker_task_id_fkey(description)')
      .eq('blocked_task_id', taskId);

    if (error) throw error;

    const transformed = (blockers || []).map((b: any) => {
      const blockerTask = Array.isArray(b.tasks) ? b.tasks[0] : b.tasks;
      return {
        id: b.id,
        blocker_task_id: b.blocker_task_id,
        blocker_description: blockerTask?.description || 'Unknown',
        blocked_task_id: b.blocked_task_id,
        reason: b.reason,
      };
    });

    return NextResponse.json({ blockers: transformed });
  } catch (error) {
    console.error('Get blockers error:', error);
    return NextResponse.json({ error: 'Failed to fetch blockers' }, { status: 500 });
  }
}

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
    const { blocker_task_id, reason } = body;

    if (!blocker_task_id || !reason) {
      return NextResponse.json({ error: 'blocker_task_id and reason required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify both tasks exist and belong to user
    const { data: tasks, error: verifyError } = await supabase
      .from('tasks')
      .select('id')
      .in('id', [taskId, blocker_task_id])
      .eq('user_id', userResult.userId);

    if (verifyError || (tasks?.length || 0) < 2) {
      return NextResponse.json({ error: 'One or both tasks not found' }, { status: 404 });
    }

    // Create blocker link
    const { data: blocker, error: insertError } = await supabase
      .from('task_blockers')
      .insert({
        blocker_task_id,
        blocked_task_id: taskId,
        reason,
      })
      .select('id, blocker_task_id, blocked_task_id, reason, tasks!task_blockers_blocker_task_id_fkey(description)')
      .single();

    if (insertError) throw insertError;

    const blockerTask = Array.isArray(blocker.tasks) ? blocker.tasks[0] : blocker.tasks;

    return NextResponse.json({
      blocker: {
        id: blocker.id,
        blocker_task_id: blocker.blocker_task_id,
        blocker_description: blockerTask?.description || 'Unknown',
        blocked_task_id: blocker.blocked_task_id,
        reason: blocker.reason,
      },
    });
  } catch (error) {
    console.error('Create blocker error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create blocker' },
      { status: 500 },
    );
  }
}
