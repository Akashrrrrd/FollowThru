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

    // Get tasks flagged for review with their hallucination flags and evidence
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(
        `
        id,
        description,
        owner,
        grace_period_ends_at,
        source_quote,
        hallucination_flags (
          id,
          reason,
          confidence,
          resolved
        ),
        commitment_evidence (
          quote,
          timestamp_in_transcript
        ),
        meetings (
          id,
          title,
          topic
        )
      `,
      )
      .eq('user_id', userResult.userId)
      .eq('flagged_for_review', true)
      .order('grace_period_ends_at', { ascending: true });

    if (error) throw error;

    // Transform data for frontend
    const transformedTasks = (tasks || []).map((task: any) => {
      const primaryFlag = task.hallucination_flags?.[0];
      const primaryEvidence = task.commitment_evidence?.[0];

      return {
        id: task.id,
        description: task.description,
        owner: task.owner,
        meeting_title: task.meetings?.title || task.meetings?.topic || 'Unknown Meeting',
        meeting_id: task.meetings?.id,
        source_quote: primaryEvidence?.quote || task.source_quote || '',
        timestamp: primaryEvidence?.timestamp_in_transcript || null,
        flag_reason: primaryFlag?.reason || 'Potential hallucination detected',
        confidence: primaryFlag?.confidence || 0.5,
        grace_period_ends_at: task.grace_period_ends_at,
        flag_id: primaryFlag?.id,
      };
    });

    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error('Get pending review error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending review tasks' },
      { status: 500 },
    );
  }
}
