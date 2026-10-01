import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { NudgeEngine } from '@/lib/integrations/nudge-engine';

/**
 * Cron job that runs daily to send nudges for overdue tasks
 * Triggered by external service (Vercel Cron, EasyCron, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const secret = request.headers.get('authorization');
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get all overdue tasks
    const now = new Date();
    const { data: overdueTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, description, owner, user_id, due_date')
      .lt('due_date', now.toISOString())
      .in('status', ['open', 'in_progress', 'blocked']);

    if (fetchError) throw fetchError;

    const nudgeSummary: Record<string, number> = {};
    const engine = new NudgeEngine(supabase);

    // Send nudges for each overdue task
    for (const task of overdueTasks || []) {
      try {
        const dueDate = new Date(task.due_date);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Get user's preferred nudge channel
        const { data: userPrefs } = await supabase
          .from('user_preferences')
          .select('nudge_channel')
          .eq('user_id', task.user_id)
          .single();

        const channel = (userPrefs?.nudge_channel || 'email') as 'email' | 'slack' | 'teams';

        const message = engine.generateNudgeMessage(task.description, daysOverdue, task.owner);

        // Only send if not sent recently (avoid spam)
        const { data: recentNudge } = await supabase
          .from('nudges')
          .select('id')
          .eq('task_id', task.id)
          .eq('user_id', task.user_id)
          .gte('sent_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .single();

        if (!recentNudge) {
          await engine.sendNudge(task.id, task.user_id, message, channel);
          nudgeSummary[channel] = (nudgeSummary[channel] || 0) + 1;
        }
      } catch (err) {
        console.error(`Failed to nudge task ${task.id}:`, err);
      }
    }

    return NextResponse.json({
      nudged: Object.values(nudgeSummary).reduce((a, b) => a + b, 0),
      channels: nudgeSummary,
    });
  } catch (error) {
    console.error('Nudge cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nudge cron failed' },
      { status: 500 },
    );
  }
}
