// app/api/commitments/pending-review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { HallucinationDetector } from '@/lib/hallucination-detector';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Auto-keep anything whose review window already ended (non-blocking).
    try {
      await new HallucinationDetector(supabase).clearExpiredFlags(user.userId);
    } catch (err) {
      console.warn('Could not clear expired flags:', err);
    }

    const nowIso = new Date().toISOString();

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, description, owner, grace_period_ends_at, source_quote, meeting_id')
      .eq('user_id', user.userId)
      .eq('flagged_for_review', true)
      .gt('grace_period_ends_at', nowIso)
      .order('grace_period_ends_at', { ascending: true });

    if (tasksError) {
      console.error('Pending review tasks query failed:', tasksError);
      return NextResponse.json(
        {
          error: 'Failed to fetch pending review tasks',
          details: process.env.NODE_ENV !== 'production' ? tasksError.message : undefined,
        },
        { status: 500 },
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ tasks: [], server_now: nowIso });
    }

    const taskIds = tasks.map((t: any) => t.id);
    const meetingIds = Array.from(new Set(tasks.map((t: any) => t.meeting_id).filter(Boolean)));

    const [flagsRes, meetingsRes] = await Promise.all([
      supabase
        .from('hallucination_flags')
        .select('id, task_id, reason, confidence')
        .in('task_id', taskIds)
        .eq('resolved', false),
      meetingIds.length
        ? supabase.from('meetings').select('id, title').in('id', meetingIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (flagsRes.error) console.warn('Warning fetching flags:', flagsRes.error);
    if (meetingsRes.error) console.warn('Warning fetching meetings:', meetingsRes.error);

    const flags: any[] = flagsRes.data || [];
    const meetings: any[] = meetingsRes.data || [];

    const result = tasks.map((task: any) => {
      const flag = flags.find((f) => f.task_id === task.id);
      const meeting = meetings.find((m) => m.id === task.meeting_id);
      return {
        id: task.id,
        description: task.description,
        owner: task.owner,
        meeting_id: task.meeting_id,
        meeting_title: meeting?.title || 'Unknown meeting',
        source_quote: task.source_quote || '',
        flag_reason: flag?.reason || 'Potential hallucination detected',
        confidence: Number(flag?.confidence ?? 0.5),
        grace_period_ends_at: task.grace_period_ends_at,
        flag_id: flag?.id,
      };
    });

    // server_now lets the client correct for clock differences in the countdown.
    return NextResponse.json({ tasks: result, server_now: nowIso });
  } catch (error) {
    console.error('Get pending review error:', error);
    return NextResponse.json({ error: 'Failed to fetch pending review tasks' }, { status: 500 });
  }
}