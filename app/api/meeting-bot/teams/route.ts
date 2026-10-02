import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { TeamsBotService } from '@/lib/integrations/teams-bot-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const service = new TeamsBotService(supabase);

    // Parse request body
    const body = await request.json();

    // Microsoft Graph sends a validation token during subscription verification
    // We must return it to complete the webhook challenge
    if (body.validationToken) {
      console.log('[TEAMS WEBHOOK] Webhook verification challenge received');
      return new NextResponse(body.validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Handle subscription notifications
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
        const resourceData = notification.resourceData || {};
        const changeType = notification.changeType;

        console.log('[TEAMS WEBHOOK] Notification received', {
          changeType,
          resource: notification.resource,
          resourceDataType: resourceData['@odata.type'],
        });

        // Handle recording available notification
        if (changeType === 'created' && notification.resource?.includes('onlineMeetings')) {
          const meetingId = resourceData.meetingId || resourceData.id;
          const recordingId = resourceData.recordingId || meetingId;
          const recordingUrl = resourceData.recordingContentUrl;
          const expiresAt = resourceData.recordingContentExpirationDateTime;

          if (recordingUrl && meetingId) {
            await service.onRecordingCompleted(recordingId, meetingId, recordingUrl, expiresAt);
          }
        }
      }
    }

    // Always return 202 Accepted for webhook notifications
    return NextResponse.json({ status: 'received' }, { status: 202 });
  } catch (error) {
    console.error('[TEAMS WEBHOOK] Processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
