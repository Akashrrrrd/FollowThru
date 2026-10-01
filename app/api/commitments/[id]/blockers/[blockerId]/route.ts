import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; blockerId: string } },
) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = params.id;
    const blockerId = params.blockerId;
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

    // Delete the blocker relationship
    const { error } = await supabase
      .from('task_blockers')
      .delete()
      .eq('id', blockerId)
      .eq('blocked_task_id', taskId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete blocker error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete blocker' },
      { status: 500 },
    );
  }
}
