/**
 * Microsoft Teams Meeting Bot Service
 * Handles bot joining Teams meetings and recording/transcription workflow
 */

interface TeamsEventPayload {
  '@type': string;
  '@id': string;
  changeType: string;
  resource: string;
  tenantId?: string;
  resourceData?: {
    '@odata.type'?: string;
    id?: string;
    meetingId?: string;
    recordingId?: string;
    createdDateTime?: string;
    recordingContentUrl?: string;
    recordingContentExpirationDateTime?: string;
  };
}

export class TeamsBotService {
  private supabase: any;
  private graphAccessToken?: string;

  constructor(supabase: any, graphAccessToken?: string) {
    this.supabase = supabase;
    this.graphAccessToken = graphAccessToken;
  }

  /**
   * Handle Teams meeting started event
   */
  async onMeetingStarted(meetingId: string, organizer: string, title: string): Promise<void> {
    try {
      // Store bot interaction
      await this.supabase
        .from('meeting_bot_interactions')
        .insert({
          provider: 'teams',
          webhook_id: `teams-${meetingId}`,
          bot_user_id: 'bot-teams-001',
          last_activity: new Date().toISOString(),
        });

      // Log event
      await this.supabase.from('meeting_app_events').insert({
        meeting_id: meetingId,
        provider: 'teams',
        event_type: 'joined',
        event_data: { organizer, title },
      });

      console.log(`[TEAMS] Meeting started: ${title} (ID: ${meetingId})`);

      // Production flow:
      // 1. Join meeting using Teams SDK
      // 2. Start recording via Teams API
      // 3. Stream audio to transcription service
    } catch (err) {
      console.error(`[TEAMS] Error in onMeetingStarted:`, err);
    }
  }

  /**
   * Handle Teams meeting ended event
   */
  async onMeetingEnded(meetingId: string): Promise<void> {
    try {
      // Update bot interaction
      await this.supabase
        .from('meeting_bot_interactions')
        .update({
          last_activity: new Date().toISOString(),
        })
        .eq('webhook_id', `teams-${meetingId}`);

      // Log event
      await this.supabase.from('meeting_app_events').insert({
        meeting_id: meetingId,
        provider: 'teams',
        event_type: 'left',
      });

      console.log(`[TEAMS] Meeting ended: ${meetingId}`);

      // Production flow:
      // 1. Stop recording
      // 2. Finalize audio stream
      // 3. Wait for transcription
      // 4. Extract commitments
    } catch (err) {
      console.error(`[TEAMS] Error in onMeetingEnded:`, err);
    }
  }

  /**
   * Handle Teams recording completed event
   * Called by Microsoft Graph when a Teams meeting recording is available
   */
  async onRecordingCompleted(recordingId: string, meetingId: string, recordingUrl: string, expiresAt: string): Promise<void> {
    try {
      // Find the meeting
      let meeting = await this.supabase
        .from('meetings')
        .select('id')
        .eq('teams_meeting_id', meetingId)
        .single();

      if (!meeting.data) {
        console.warn(`[TEAMS] No meeting found for teams_meeting_id ${meetingId}`);
        return;
      }

      // Create recording metadata
      const { data: recording, error: recordingError } = await this.supabase
        .from('recordings')
        .insert({
          meeting_id: meeting.data.id,
          provider: 'teams',
          provider_recording_id: recordingId,
          download_url: recordingUrl,
          download_status: 'pending',
        })
        .select()
        .single();

      if (recordingError) {
        console.error(`[TEAMS] Failed to create recording metadata:`, recordingError);
        return;
      }

      console.log(`[TEAMS] Recording completed: ${recordingId}`, {
        meetingId,
        expiresAt,
      });

      // Update meeting with recording info
      await this.supabase
        .from('meetings')
        .update({
          teams_meeting_id: meetingId,
          recording_url: recordingUrl,
          recording_provider: 'teams',
          transcription_status: 'pending',
          transcription_service: 'groq',
        })
        .eq('id', meeting.data.id);

      // Production flow:
      // 1. Download recording before expiration (Teams recordings expire after 21 days)
      // 2. Stream to speech-to-text service
      // 3. Extract commitments
    } catch (err) {
      console.error(`[TEAMS] Error in onRecordingCompleted:`, err);
    }
  }

  /**
   * Verify Microsoft Graph subscription webhook token
   * Teams/Graph sends validation tokens for webhook verification
   */
  async verifyWebhookToken(validationToken: string): Promise<string> {
    // Return the validation token to complete the challenge
    // Microsoft Graph requires returning the token to verify webhook subscription
    return validationToken;
  }

  /**
   * Exchange Microsoft OAuth code for access token
   * Called during OAuth callback to get Teams Graph API credentials
   */
  async exchangeTeamsAuthCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.TEAMS_CLIENT_ID;
    const clientSecret = process.env.TEAMS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('TEAMS_CLIENT_ID or TEAMS_CLIENT_SECRET not configured');
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/.default offline_access',
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Teams OAuth failed: ${errorText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Create Microsoft Graph subscription for meeting recording events
   * Allows receiving webhooks when recordings are completed
   */
  async createGraphSubscription(userId: string, accessToken: string, webhookUrl: string): Promise<string> {
    if (!accessToken) {
      throw new Error('Access token required to create subscription');
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl: webhookUrl,
        resource: `/users/${userId}/onlineMeetings?$filter=RecordingAvailable eq true`,
        expirationDateTime: new Date(Date.now() + 4380 * 60 * 1000).toISOString(), // 73 hours (max allowed)
        clientState: 'followthru-teams-bot',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Graph subscription: ${errorText}`);
    }

    const data = await response.json();
    return data.id;
  }
}
