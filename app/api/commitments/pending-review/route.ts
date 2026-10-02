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

    // Get tasks flagged for review - simpler query to avoid RLS issues
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, description, owner, grace_period_ends_at, source_quote, meeting_id')
      .eq('user_id', userResult.userId)
      .eq('flagged_for_review', true)
      .order('grace_period_ends_at', { ascending: true });

    if (tasksError) throw tasksError;

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    // Fetch related data separately to avoid RLS cascading issues
    const taskIds = tasks.map(t => t.id);
    
    // Get hallucination flags for these tasks
    const { data: flags, error: flagsError } = await supabase
      .from('hallucination_flags')
      .select('id, task_id, reason, confidence, resolved')
      .in('task_id', taskIds);

    if (flagsError) console.warn('Warning fetching flags:', flagsError);

    // Get commitment evidence for these tasks
    const { data: evidence, error: evidenceError } = await supabase
      .from('commitment_evidence')
      .select('task_id, quote, timestamp_in_transcript')
      .in('task_id', taskIds);

    if (evidenceError) console.warn('Warning fetching evidence:', evidenceError);

    // Get meeting details for these tasks
    const meetingIdSet = new Set<string>();
    tasks.forEach((t: any) => {
      if (t.meeting_id) {
        meetingIdSet.add(t.meeting_id);
      }
    });
    const meetingIds = Array.from(meetingIdSet);
    let meetingData: any[] = [];
    
    if (meetingIds.length > 0) {
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, title, topic')
        .in('id', meetingIds);
      
      if (meetingsError) console.warn('Warning fetching meetings:', meetingsError);
      meetingData = meetings || [];
    }

    // Transform data for frontend
    const transformedTasks = tasks.map((task: any) => {
      const taskFlags = flags?.filter((f: any) => f.task_id === task.id) || [];
      const taskEvidence = evidence?.filter((e: any) => e.task_id === task.id) || [];
      const meeting = meetingData.find((m: any) => m.id === task.meeting_id);

      const primaryFlag = taskFlags[0];
      const primaryEvidence = taskEvidence[0];

      return {
        id: task.id,
        description: task.description,
        owner: task.owner,
        meeting_title: meeting?.title || meeting?.topic || 'Unknown Meeting',
        meeting_id: task.meeting_id,
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
