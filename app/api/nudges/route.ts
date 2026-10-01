import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';
import { NudgeEngine } from '@/lib/integrations/nudge-engine';

export async function POST(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { task_id, message, channel = 'email' } = body;

    if (!task_id || !message) {
      return NextResponse.json(
        { error: 'task_id and message required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const engine = new NudgeEngine(supabase);

    const nudgeId = await engine.sendNudge(task_id, userResult.userId, message, channel);

    return NextResponse.json({ id: nudgeId, sent: true });
  } catch (error) {
    console.error('Send nudge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send nudge' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const engine = new NudgeEngine(supabase);

    const nudges = await engine.getPendingNudges(userResult.userId);

    return NextResponse.json({ nudges });
  } catch (error) {
    console.error('Get nudges error:', error);
    return NextResponse.json({ error: 'Failed to fetch nudges' }, { status: 500 });
  }
}
