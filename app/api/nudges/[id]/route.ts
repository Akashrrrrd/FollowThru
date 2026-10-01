import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getUserFromRequest } from '@/lib/supabase-server';
import { NudgeEngine } from '@/lib/integrations/nudge-engine';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userResult = await getUserFromRequest(request);
    if (!userResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nudgeId = params.id;
    const body = await request.json();
    const { action } = body;

    if (!action || !['open', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = createServerClient();
    const engine = new NudgeEngine(supabase);

    if (action === 'open') {
      await engine.markNudgeOpened(nudgeId);
    } else if (action === 'dismiss') {
      await engine.dismissNudge(nudgeId);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Update nudge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update nudge' },
      { status: 500 },
    );
  }
}
