import { NextRequest, NextResponse } from 'next/server';
import type { ExtractedCommitment } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Mock extracted commitments for demo purposes - no AI, instant response
const MOCK_COMMITMENTS: ExtractedCommitment[] = [
  {
    owner: 'Vikram',
    description: 'Complete database migration',
    due_date: '2025-10-08',
    source_quote: 'I can have the database migration ready by October 8th.',
    confidence: 'high',
    dependency: null,
    commitment_type: 'explicit',
  },
  {
    owner: 'Rahul',
    description: 'Handle API integration and endpoints',
    due_date: '2025-10-11',
    source_quote: 'I can knock that out in 3 days, so by October 11th.',
    confidence: 'high',
    dependency: 'Vikram: Complete database migration',
    commitment_type: 'explicit',
  },
  {
    owner: 'Ananya',
    description: 'Update UI components and design system',
    due_date: '2025-10-10',
    source_quote: 'I\'ll have the UI components and design system updated by October 10th.',
    confidence: 'high',
    dependency: null,
    commitment_type: 'explicit',
  },
  {
    owner: 'Rahul',
    description: 'Send API specification',
    due_date: '2025-10-09',
    source_quote: 'I\'ll send you the API spec by October 9th morning.',
    confidence: 'high',
    dependency: null,
    commitment_type: 'explicit',
  },
  {
    owner: 'Vikram',
    description: 'Update database documentation',
    due_date: '2025-10-11',
    source_quote: 'I\'ll also update the database documentation by end of week.',
    confidence: 'medium',
    dependency: null,
    commitment_type: 'explicit',
  },
  {
    owner: 'Priya',
    description: 'Schedule final integration test meeting',
    due_date: '2025-10-15',
    source_quote: 'We\'ll schedule a final integration test meeting for October 15th.',
    confidence: 'high',
    dependency: null,
    commitment_type: 'collective',
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, transcript, your_name } = body as {
      title?: string;
      transcript?: string;
      your_name?: string;
    };

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Meeting title is required.' }, { status: 400 });
    }

    // Validate transcript presence and minimum length
    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: 'Transcript is required. Please paste a meeting transcript to extract commitments from.' },
        { status: 400 },
      );
    }

    const trimmedTranscript = transcript.trim();

    // Check for extremely short transcripts (less meaningful for extraction)
    if (trimmedTranscript.length < 50) {
      return NextResponse.json(
        {
          error:
            'Transcript is too short. Please provide a more detailed transcript with at least a few exchanges between participants (e.g., "Person A: ... Person B: ...").',
        },
        { status: 400 },
      );
    }

    // Check for transcript that might be mostly noise/non-meaningful
    const wordCount = trimmedTranscript.split(/\s+/).length;
    if (wordCount < 20) {
      return NextResponse.json(
        { error: 'Transcript is too brief. Please provide a transcript with more content (at least 20 words).' },
        { status: 400 },
      );
    }

    // Return mock commitments instantly (demo mode - no AI, no database)
    return NextResponse.json({
      commitments: MOCK_COMMITMENTS,
      your_name: your_name || 'You',
      demo: true,
    });
  } catch (err) {
    console.error('[extract-demo] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to extract commitments: ${message}` },
      { status: 500 },
    );
  }
}
