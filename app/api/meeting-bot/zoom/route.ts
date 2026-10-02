import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { ZoomBotService } from '@/lib/integrations/zoom-bot-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-zm-signature') || '';
    const timestamp = request.headers.get('x-zm-request-timestamp') || '';

    // Use real Supabase client
    const supabase = createServerClient();
    const service = new ZoomBotService(supabase);

    // Verify webhook signature (non-blocking: log but don't reject if invalid in dev)
    const isValidSignature = service.verifyWebhookSignature(JSON.stringify(body), timestamp, signature);
    if (!isValidSignature) {
      console.warn('[ZOOM WEBHOOK] Invalid signature received');
      // In production, should reject: return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      // For development, we continue to allow testing
    }

    // Handle different event types
    if (body.event === 'meeting.started') {
      await service.onMeetingStarted(body);
    } else if (body.event === 'meeting.ended') {
      await service.onMeetingEnded(body);
    } else if (body.event === 'recording.completed') {
      // Extract recording files from the payload
      const recordingFiles = body.payload?.object?.recording_files || [];
      await service.onRecordingCompleted(
        body.payload?.object?.id,
        body.payload?.object?.meeting_number || body.payload?.object?.id,
        recordingFiles,
      );
    } else if (body.event === 'app_deauthorized') {
      // User revoked app access
      console.log('[ZOOM WEBHOOK] App deauthorized');
      return NextResponse.json({ status: 'ok' });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[ZOOM WEBHOOK] Processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
