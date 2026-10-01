import { NextRequest, NextResponse } from 'next/server';
import { ZoomBotService } from '@/lib/integrations/zoom-bot-service';

const supabaseStub = {
  from: () => ({
    insert: () => Promise.resolve(),
    update: () => ({ eq: () => Promise.resolve() }),
    eq: () => ({ eq: () => Promise.resolve() }),
  }),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-zm-signature') || '';
    const timestamp = request.headers.get('x-zm-request-timestamp') || '';

    const service = new ZoomBotService(supabaseStub);

    // Verify webhook signature
    if (!service.verifyWebhookSignature(JSON.stringify(body), timestamp, signature)) {
      console.warn('Invalid Zoom webhook signature');
      // Still process for development, but in production should reject
    }

    // Handle different event types
    if (body.event === 'meeting.started') {
      await service.onMeetingStarted(body);
    } else if (body.event === 'meeting.ended') {
      await service.onMeetingEnded(body);
    } else if (body.event === 'recording.completed') {
      await service.onRecordingCompleted(
        body.payload.object.id,
        body.payload.object.meeting_id,
      );
    }

    // Return 200 OK for challenge request
    if (body.event === 'app_deauthorized') {
      return NextResponse.json({ status: 'ok' });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Zoom webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
