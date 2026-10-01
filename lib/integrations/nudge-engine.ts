import { createClient } from '@supabase/supabase-js';

export class NudgeEngine {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Send nudge for overdue task via email, Slack, or Teams
   */
  async sendNudge(
    taskId: string,
    userId: string,
    message: string,
    channel: 'email' | 'slack' | 'teams' = 'email',
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('nudges')
      .insert({
        task_id: taskId,
        user_id: userId,
        message,
        channel,
        sent_at: new Date(),
      })
      .select('id')
      .single();

    if (error) throw error;

    // Actually send the nudge
    await this.deliverNudge(userId, message, channel);

    return data.id;
  }

  /**
   * Deliver nudge to the user via their preferred channel
   */
  private async deliverNudge(
    userId: string,
    message: string,
    channel: 'email' | 'slack' | 'teams',
  ): Promise<void> {
    if (channel === 'slack') {
      await this.sendSlackNudge(userId, message);
    } else if (channel === 'teams') {
      await this.sendTeamsNudge(userId, message);
    } else if (channel === 'email') {
      // Email already handled by email provider
      console.log(`[NUDGE EMAIL] ${message}`);
    }
  }

  /**
   * Send nudge via Slack webhook
   */
  private async sendSlackNudge(userId: string, message: string): Promise<void> {
    try {
      // Get user's Slack webhook URL from integration
      const { data: integration } = await this.supabase
        .from('integration_clients')
        .select('access_token')
        .eq('user_id', userId)
        .eq('provider', 'slack')
        .single();

      if (!integration?.access_token) {
        console.warn(`Slack integration not found for user ${userId}`);
        return;
      }

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${integration.access_token}`,
        },
        body: JSON.stringify({
          channel: 'C0XXXXXXXX', // Would be stored per user
          text: message,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔔 *FollowThru Reminder*\n${message}`,
              },
            },
          ],
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.error('Slack API error:', data.error);
      }
    } catch (err) {
      console.error('Slack nudge error:', err);
    }
  }

  /**
   * Send nudge via Teams webhook
   */
  private async sendTeamsNudge(userId: string, message: string): Promise<void> {
    try {
      // Get user's Teams webhook URL
      const { data: integration } = await this.supabase
        .from('integration_clients')
        .select('access_token')
        .eq('user_id', userId)
        .eq('provider', 'teams')
        .single();

      if (!integration?.access_token) {
        console.warn(`Teams integration not found for user ${userId}`);
        return;
      }

      const response = await fetch(integration.access_token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              contentUrl: null,
              content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                body: [
                  {
                    type: 'TextBlock',
                    text: '🔔 FollowThru Reminder',
                    weight: 'bolder',
                    size: 'large',
                  },
                  {
                    type: 'TextBlock',
                    text: message,
                    wrap: true,
                  },
                ],
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error('Teams API error:', response.statusText);
      }
    } catch (err) {
      console.error('Teams nudge error:', err);
    }
  }

  /**
   * Get pending nudges
   */
  async getPendingNudges(userId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('nudges')
      .select('*, tasks(*)')
      .eq('user_id', userId)
      .is('opened_at', null)
      .order('sent_at', { ascending: true });

    return data || [];
  }

  /**
   * Mark nudge as opened
   */
  async markNudgeOpened(nudgeId: string): Promise<void> {
    await this.supabase
      .from('nudges')
      .update({ opened_at: new Date() })
      .eq('id', nudgeId);
  }

  /**
   * Dismiss nudge
   */
  async dismissNudge(nudgeId: string): Promise<void> {
    await this.supabase
      .from('nudges')
      .update({ dismissed_at: new Date() })
      .eq('id', nudgeId);
  }

  /**
   * Generate nudge message
   */
  generateNudgeMessage(taskDescription: string, daysOverdue: number, owner: string): string {
    if (daysOverdue === 0) {
      return `Reminder: "${taskDescription}" is due today. Owner: ${owner}`;
    }
    return `Alert: "${taskDescription}" is ${daysOverdue} days overdue. Owner: ${owner}`;
  }
}
