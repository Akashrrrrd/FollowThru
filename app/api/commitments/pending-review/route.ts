import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get tasks flagged for review with their hallucination flags
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(
        `
        id,
        description,
        owner,
        grace_period_ends_at,
        hallucination_flags (
          reason,
          confidence
        ),
        meetings (
          title
        )
      `,
      )
      .eq('user_id', userResult.userId)
      .eq('flagged_for_review', true)
      .order('grace_period_ends_at', { ascending: true });

    if (error) throw error;

    // Transform data for frontend
    const transformedTasks = (tasks || []).map((task: any) => ({
      id: task.id,
      description: task.description,
      owner: task.owner,
      meeting_title: task.meetings?.title || 'Unknown Meeting',
      source_quote: '', // Would be populated from evidence
      flag_reason: task.hallucination_flags?.[0]?.reason || 'Potential hallucination detected',
      confidence: task.hallucination_flags?.[0]?.confidence || 0.5,
      grace_period_ends_at: task.grace_period_ends_at,
    }));

    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error('Get pending review error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending review tasks' },
      { status: 500 },
    );
  }
}
