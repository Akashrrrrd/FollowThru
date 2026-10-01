import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { HallucinationDetector } from '@/lib/hallucination-detector';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { meeting_id, task_id, transcript, description, owner, due_date } = body;

    if (!transcript || !description) {
      return NextResponse.json(
        { error: 'transcript and description required' },
        { status: 400 },
      );
    }

    const detector = new HallucinationDetector(supabase);
    const result = await detector.checkExtraction(transcript, description, owner || 'Unassigned', due_date || '');

    if (result.isHallucination && meeting_id && task_id) {
      await detector.flagHallucination(meeting_id, task_id, result.reason, result.confidence);
    }

    return NextResponse.json({
      isHallucination: result.isHallucination,
      confidence: result.confidence,
      reason: result.reason,
    });
  } catch (error) {
    console.error('Hallucination check error:', error);
    return NextResponse.json({ error: 'Failed to check hallucination' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const meetingId = request.nextUrl.searchParams.get('meeting_id');

    if (!meetingId) {
      return NextResponse.json({ error: 'meeting_id required' }, { status: 400 });
    }

    const detector = new HallucinationDetector(supabase);
    const flags = await detector.getFlaggedTasks(meetingId);

    return NextResponse.json({ flags });
  } catch (error) {
    console.error('Get flags error:', error);
    return NextResponse.json({ error: 'Failed to get flags' }, { status: 500 });
  }
}
