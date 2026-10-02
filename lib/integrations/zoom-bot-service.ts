/**
 * Zoom Meeting Bot Service
 * Handles bot joining meetings, recording, and transcription workflow
 */

import crypto from 'crypto';

interface ZoomMeetingEvent {
  event: string;
  payload: {
    object: {
      id: string;
      start_time: string;
      topic: string;
      organizer_id: string;
      meeting_number?: string;
      duration?: number;
      recording_count?: number;
      recording_files?: Array<{
        id: string;
        recording_start: string;
        recording_end: string;
        file_size: number;
        play_url: string;
        download_url: string;
        file_extension: string;
        file_type: string;
      }>;
    };
  };
}

export class ZoomBotService {
  private supabase: any;
  private zoomAccessToken?: string;

  constructor(supabase: any, zoomAccessToken?: string) {
    this.supabase = supabase;
    this.zoomAccessToken = zoomAccessToken;
  }

  /**
   * Handle Zoom meeting started webhook
   */
  async onMeetingStarted(event: ZoomMeetingEvent): Promise<void> {
    const { id: meetingId, start_time, topic, organizer_id } = event.payload.object;

    try {
      // Store meeting bot interaction
      await this.supabase
        .from('meeting_bot_interactions')
        .insert({
          provider: 'zoom',
          webhook_id: `zoom-${meetingId}`,
          bot_user_id: 'bot-zoom-001',
          last_activity: new Date().toISOString(),
        })
        .select()
        .single();

      // Log event
      await this.supabase.from('meeting_app_events').insert({
        meeting_id: meetingId,
        provider: 'zoom',
        event_type: 'joined',
        event_data: { start_time, topic, organizer_id },
      });

      console.log(`[ZOOM] Meeting started: ${topic} (ID: ${meetingId})`);

      // In production flow:
      // 1. Start recording via Zoom API
      // 2. Store zoom_meeting_id in meetings table
      // 3. Begin audio streaming to transcription service
    } catch (err) {
      console.error(`[ZOOM] Error in onMeetingStarted:`, err);
    }
  }

  /**
   * Handle Zoom meeting ended webhook
   */
  async onMeetingEnded(event: ZoomMeetingEvent): Promise<void> {
    const { id: meetingId } = event.payload.object;

    try {
      // Update bot interaction
      await this.supabase
        .from('meeting_bot_interactions')
        .update({
          last_activity: new Date().toISOString(),
        })
        .eq('webhook_id', `zoom-${meetingId}`);

      // Log event
      await this.supabase.from('meeting_app_events').insert({
        meeting_id: meetingId,
        provider: 'zoom',
        event_type: 'left',
      });

      console.log(`[ZOOM] Meeting ended: ${meetingId}`);

      // Production flow:
      // 1. Stop recording
      // 2. Finalize audio stream to transcription
      // 3. Wait for transcription job to complete
      // 4. Extract commitments from transcript
    } catch (err) {
      console.error(`[ZOOM] Error in onMeetingEnded:`, err);
    }
  }

  /**
   * Handle Zoom recording completed webhook
   * This is called by Zoom when the recording file is ready for download
   */
  async onRecordingCompleted(recordingId: string, meetingId: string, recordingFiles?: any[]): Promise<void> {
    try {
      // Find or create the meeting record
      let meeting = await this.supabase
        .from('meetings')
        .select('id')
        .eq('zoom_meeting_id', meetingId)
        .single();

      if (!meeting.data) {
        console.warn(`[ZOOM] No meeting found for zoom_meeting_id ${meetingId}`);
        return;
      }

      // Create recording metadata entry
      const primaryRecording = recordingFiles?.[0] || {};
      const { data: recording, error: recordingError } = await this.supabase
        .from('recordings')
        .insert({
          meeting_id: meeting.data.id,
          provider: 'zoom',
          provider_recording_id: recordingId,
          download_url: primaryRecording.download_url || '',
          file_size_bytes: primaryRecording.file_size || 0,
          duration_ms: (primaryRecording.duration || 0) * 1000,
          format: primaryRecording.file_extension?.toLowerCase() || 'mp4',
          download_status: 'pending',
        })
        .select()
        .single();

      if (recordingError) {
        console.error(`[ZOOM] Failed to create recording metadata:`, recordingError);
        return;
      }

      console.log(`[ZOOM] Recording completed: ${recordingId}`, {
        meetingId,
        fileSize: primaryRecording.file_size,
        duration: primaryRecording.duration,
      });

      // Update meeting with recording and transcription status
      await this.supabase
        .from('meetings')
        .update({
          zoom_meeting_id: meetingId,
          recording_url: primaryRecording.download_url,
          recording_provider: 'zoom',
          recording_duration_ms: (primaryRecording.duration || 0) * 1000,
          transcription_status: 'pending',
          transcription_service: 'groq',
        })
        .eq('id', meeting.data.id);

      // In production, would:
      // 1. Download the recording file (async, non-blocking)
      // 2. Stream to speech-to-text service (Groq Whisper, AssemblyAI, etc.)
      // 3. Create transcription job entry
      // 4. Poll for transcription completion
      // 5. Extract commitments using existing Groq extraction pipeline
      // 6. Update meeting with extracted commitments
    } catch (err) {
      console.error(`[ZOOM] Error in onRecordingCompleted:`, err);
    }
  }

  /**
   * Verify Zoom webhook signature for authenticity
   * Zoom sends: x-zm-signature header with format v0:base64hash
   * We verify by computing HMAC-SHA256 of v0:timestamp:token
   */
  verifyWebhookSignature(
    bodyString: string,
    timestamp: string,
    signature: string,
  ): boolean {
    try {
      const secret = process.env.ZOOM_WEBHOOK_SECRET || '';
      if (!secret) {
        console.warn('[ZOOM] ZOOM_WEBHOOK_SECRET not configured');
        return false;
      }

      // Zoom webhook signature format: v0:base64hash
      const message = `v0:${timestamp}:${bodyString}`;
      const hash = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');

      const expectedSignature = `v0:${hash}`;
      const isValid = expectedSignature === signature;

      if (!isValid) {
        console.warn('[ZOOM] Invalid webhook signature', {
          expected: expectedSignature,
          received: signature,
        });
      }

      return isValid;
    } catch (err) {
      console.error('[ZOOM] Error verifying webhook signature:', err);
      return false;
    }
  }

  /**
   * Exchange Zoom authorization code for access token
   * Called during OAuth callback to get credentials for API access
   */
  async exchangeZoomAuthCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET not configured');
    }

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoom OAuth failed: ${errorText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }
}
