import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest, createUserClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Quick seed endpoint that uses user-scoped client to respect RLS.
 * This should properly create tasks for the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    console.log('[QUICK SEED] Auth header:', req.headers.get('authorization')?.substring(0, 20));
    console.log('[QUICK SEED] User result:', user);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication failed - no bearer token or unable to extract user ID' },
        { status: 401 },
      );
    }

    console.log('[QUICK SEED] Creating demo data for user:', user.userId);

    // Use user-scoped client to respect RLS
    const userClient = createUserClient(user.token);

    // Create a single test meeting
    const { data: meeting, error: meetingError } = await userClient
      .from('meetings')
      .insert({
        user_id: user.userId,
        title: 'Quick Demo Meeting',
        transcript: 'Alex: I will complete the API documentation by Friday.',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (meetingError || !meeting) {
      console.error('[QUICK SEED] Failed to create meeting:', meetingError);
      return NextResponse.json(
        { error: `Failed to create meeting: ${meetingError?.message}` },
        { status: 500 },
      );
    }

    console.log('[QUICK SEED] Meeting created:', meeting.id);

    // Create a single test task
    const { data: task, error: taskError } = await userClient
      .from('tasks')
      .insert({
        meeting_id: meeting.id,
        user_id: user.userId,
        description: 'Complete API documentation',
        owner: 'Alex',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        source_quote: 'I will complete the API documentation by Friday.',
        status: 'open',
        confidence: 'high',
        commitment_type: 'explicit',
      })
      .select()
      .single();

    if (taskError || !task) {
      console.error('[QUICK SEED] Failed to create task:', taskError);
      return NextResponse.json(
        { error: `Failed to create task: ${taskError?.message}` },
        { status: 500 },
      );
    }

    console.log('[QUICK SEED] Task created:', task.id);

    return NextResponse.json({
      success: true,
      message: 'Quick demo data created successfully!',
      data: {
        meeting_id: meeting.id,
        task_id: task.id,
        user_id: user.userId,
      },
    });
  } catch (err) {
    console.error('[QUICK SEED] Error:', err);
    return NextResponse.json(
      { error: `Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 },
    );
  }
}
