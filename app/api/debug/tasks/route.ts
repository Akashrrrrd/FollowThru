import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * DEBUG ONLY: Show all tasks in database with their user_ids
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();

    // Get all tasks and their user_ids
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, description, user_id, status')
      .limit(20);

    const taskUserIds: (string | null)[] = [];
    if (tasks) {
      tasks.forEach(t => {
        if (t.user_id && !taskUserIds.includes(t.user_id)) {
          taskUserIds.push(t.user_id);
        }
      });
    }

    return NextResponse.json({
      message: 'DEBUG: Tasks in database',
      tasks_sample: tasks || [],
      total_tasks: tasks?.length || 0,
      distinct_user_ids: taskUserIds,
      your_user_id: '6287ed99-eccf-4afd-a9ba-a87de0dc7d3f',
      sql_to_fix: `UPDATE tasks SET user_id = '6287ed99-eccf-4afd-a9ba-a87de0dc7d3f' WHERE 1=1;`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
