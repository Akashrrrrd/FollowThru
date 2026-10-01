import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demo/seed
 * 
 * Seeds the current user's database with demo data showing Commitment Continuity.
 * Creates:
 * - Meeting 1 (Sept 26): Multiple commitments including database migration
 * - Meeting 2 (Sept 29): Follow-up meeting with same commitments linked via continuity
 * 
 * Demonstrates: multi-person, explicit dates, dependencies, carry-over functionality
 * 
 * Safe: Only seeds data for the authenticated user, never touches other users' data
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to seed demo data.' },
        { status: 401 },
      );
    }

    const supabase = createServerClient();

    // Check if user already has demo data (to avoid duplicates)
    const { data: existingMeetings, error: checkError } = await supabase
      .from('meetings')
      .select('id, title')
      .eq('user_id', user.userId)
      .ilike('title', '%Mobile App Launch%')
      .limit(1);

    if (checkError) {
      console.error('Error checking existing meetings:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing data.' },
        { status: 500 },
      );
    }

    if (existingMeetings && existingMeetings.length > 0) {
      return NextResponse.json(
        {
          warning: 'Demo data already exists for this account.',
          message:
            'You already have the demo meeting "Q4 Mobile App Launch" in your account. No new data was seeded.',
        },
        { status: 200 },
      );
    }

    // Insert Meeting 1
    const meeting1Date = new Date('2026-09-26');
    const { data: meeting1, error: meeting1Error } = await supabase
      .from('meetings')
      .insert({
        user_id: user.userId,
        title: 'Q4 Mobile App Launch - Technical Planning',
        transcript: `Priya: Alright, let's talk about the launch timeline. We have 4 weeks to ship the mobile app update.
Vikram: I can have the database migration ready by October 8th. After that, Rahul can start the API integration.
Rahul: Sure, once Vikram finishes the migration, I'll handle the API endpoints. I can knock that out in 3 days, so by October 11th.
Priya: Perfect. Ananya, can you work on the mobile UI components?
Ananya: I'll have the UI components and design system updated by October 10th. But I'll need the final API spec by October 9th at the latest.
Rahul: I'll send you the API spec by October 9th morning.
Vikram: One more thing — I'll also update the database documentation by end of week.
Priya: Great. We'll schedule a final integration test meeting for October 15th to verify everything works together.`,
        created_at: meeting1Date.toISOString(),
      })
      .select()
      .single();

    if (meeting1Error || !meeting1) {
      console.error('Failed to insert meeting 1:', meeting1Error);
      return NextResponse.json({ error: 'Failed to create demo meeting 1.' }, { status: 500 });
    }

    // Insert tasks for Meeting 1
    const tasks1 = [
      {
        meeting_id: meeting1.id,
        user_id: user.userId,
        description: 'Complete database migration',
        owner: 'Vikram',
        due_date: '2026-10-08',
        source_quote: 'I can have the database migration ready by October 8th.',
        status: 'open' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: null,
      },
      {
        meeting_id: meeting1.id,
        user_id: user.userId,
        description: 'Implement API endpoints',
        owner: 'Rahul',
        due_date: '2026-10-11',
        source_quote:
          "Sure, once Vikram finishes the migration, I'll handle the API endpoints. I can knock that out in 3 days, so by October 11th.",
        status: 'open' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: 'Vikram finishes database migration',
      },
      {
        meeting_id: meeting1.id,
        user_id: user.userId,
        description: 'Update UI components and design system',
        owner: 'Ananya',
        due_date: '2026-10-10',
        source_quote: "I'll have the UI components and design system updated by October 10th.",
        status: 'open' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: null,
      },
      {
        meeting_id: meeting1.id,
        user_id: user.userId,
        description: 'Send final API specification',
        owner: 'Rahul',
        due_date: '2026-10-09',
        source_quote: "I'll send you the API spec by October 9th morning.",
        status: 'open' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: null,
      },
      {
        meeting_id: meeting1.id,
        user_id: user.userId,
        description: 'Update database documentation',
        owner: 'Vikram',
        due_date: '2026-09-30',
        source_quote: "One more thing — I'll also update the database documentation by end of week.",
        status: 'completed' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: null,
      },
      {
        meeting_id: meeting1.id,
        user_id: user.userId,
        description: 'Schedule final integration test meeting',
        owner: 'Unassigned',
        due_date: '2026-10-15',
        source_quote: "Great. We'll schedule a final integration test meeting for October 15th to verify everything works together.",
        status: 'open' as const,
        confidence: 'medium' as const,
        commitment_type: 'collective' as const,
        dependency: null,
      },
    ];

    const { error: tasks1Error } = await supabase.from('tasks').insert(tasks1);

    if (tasks1Error) {
      console.error('Failed to insert tasks for meeting 1:', tasks1Error);
      return NextResponse.json({ error: 'Failed to create demo tasks for meeting 1.' }, { status: 500 });
    }

    // Insert Meeting 2 (3 days later, Sept 29)
    const meeting2Date = new Date('2026-09-29');
    const { data: meeting2, error: meeting2Error } = await supabase
      .from('meetings')
      .insert({
        user_id: user.userId,
        title: 'Q4 Mobile App Launch - Status Check',
        transcript: `Priya: Let's do a quick status check. How are we looking?
Vikram: Database migration is on track. I finished the documentation like I planned, and the migration is 80% done. Still targeting October 8th.
Rahul: Good news — I already sent the API spec to Ananya. I can start the implementation right after Vikram finishes the migration on the 8th, so October 11th is still realistic.
Ananya: Thanks Rahul! I have the spec now. The UI components are looking good. I'm still on target for October 10th.
Priya: Excellent. We're all aligned. Let's confirm the database migration is still on track for October 8th and we can proceed.`,
        created_at: meeting2Date.toISOString(),
      })
      .select()
      .single();

    if (meeting2Error || !meeting2) {
      console.error('Failed to insert meeting 2:', meeting2Error);
      return NextResponse.json({ error: 'Failed to create demo meeting 2.' }, { status: 500 });
    }

    // Insert tasks for Meeting 2 (these will be linked via Commitment Continuity)
    const tasks2 = [
      {
        meeting_id: meeting2.id,
        user_id: user.userId,
        description: 'Complete database migration',
        owner: 'Vikram',
        due_date: '2026-10-08',
        source_quote:
          'Database migration is on track. I finished the documentation like I planned, and the migration is 80% done. Still targeting October 8th.',
        status: 'in_progress' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: null,
      },
      {
        meeting_id: meeting2.id,
        user_id: user.userId,
        description: 'Implement API endpoints',
        owner: 'Rahul',
        due_date: '2026-10-11',
        source_quote:
          'I can start the implementation right after Vikram finishes the migration on the 8th, so October 11th is still realistic.',
        status: 'open' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: 'Vikram finishes database migration',
      },
      {
        meeting_id: meeting2.id,
        user_id: user.userId,
        description: 'Update UI components and design system',
        owner: 'Ananya',
        due_date: '2026-10-10',
        source_quote: "The UI components are looking good. I'm still on target for October 10th.",
        status: 'in_progress' as const,
        confidence: 'high' as const,
        commitment_type: 'explicit' as const,
        dependency: null,
      },
    ];

    const { error: tasks2Error } = await supabase.from('tasks').insert(tasks2);

    if (tasks2Error) {
      console.error('Failed to insert tasks for meeting 2:', tasks2Error);
      return NextResponse.json({ error: 'Failed to create demo tasks for meeting 2.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Demo data seeded successfully!',
        details: {
          meeting1: {
            title: meeting1.title,
            date: meeting1Date.toDateString(),
            taskCount: 6,
            description:
              'Initial planning meeting with 6 commitments including dependencies and a completed task',
          },
          meeting2: {
            title: meeting2.title,
            date: meeting2Date.toDateString(),
            taskCount: 3,
            description:
              'Follow-up status meeting where same commitments appear again, demonstrating Commitment Continuity',
          },
          continuityDemo:
            'Same commitments (Vikram migration, Rahul API, Ananya UI) appear in both meetings. The system should link them via Commitment Continuity, showing they are the same promise with updated status.',
          nextSteps:
            'Go to /dashboard to see commitments from both meetings. Check the meetings list to compare Meeting 1 vs Meeting 2. Open individual commitments to see source quotes.',
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Demo seed error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to seed demo data: ${message}` }, { status: 500 });
  }
}
