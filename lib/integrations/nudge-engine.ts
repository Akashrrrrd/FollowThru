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
    channel?: 'email' | 'slack' | 'teams',
  ): Promise<string> {
    // If channel not specified, get user's preference
    let deliveryChannel = channel;
    if (!deliveryChannel) {
      const { data: prefs } = await this.supabase
        .from('user_preferences')
        .select('nudge_channel')
        .eq('user_id', userId)
        .single();
      deliveryChannel = (prefs?.nudge_channel || 'email') as 'email' | 'slack' | 'teams';
    }

    const { data, error } = await this.supabase
      .from('nudges')
      .insert({
        task_id: taskId,
        user_id: userId,
        message,
        channel: deliveryChannel,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    // Actually deliver the nudge
    await this.deliverNudge(userId, message, deliveryChannel);

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
      // Email delivery via email provider
      console.log(`[NUDGE EMAIL] To: user ${userId}\n${message}`);
    }
  }

  /**
   * Send nudge via Slack webhook with proper channel ID
   */
  private async sendSlackNudge(userId: string, message: string): Promise<void> {
    try {
      // Get user's Slack preferences
      const { data: prefs } = await this.supabase
        .from('user_preferences')
        .select('slack_channel_id, slack_team_id')
        .eq('user_id', userId)
        .single();

      if (!prefs?.slack_channel_id) {
        console.warn(`Slack channel not configured for user ${userId}`);
        return;
      }

      // Get Slack integration token
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
          channel: prefs.slack_channel_id,
          text: message,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔔 *FollowThru Reminder*\n${message}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Task',
                  },
                  url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
                  style: 'primary',
                },
              ],
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
      // Get user's Teams preferences
      const { data: prefs } = await this.supabase
        .from('user_preferences')
        .select('teams_webhook_url, teams_channel_id')
        .eq('user_id', userId)
        .single();

      if (!prefs?.teams_webhook_url) {
        console.warn(`Teams webhook not configured for user ${userId}`);
        return;
      }

      const response = await fetch(prefs.teams_webhook_url, {
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
                actions: [
                  {
                    type: 'Action.OpenUrl',
                    title: 'View Task',
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
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
      .is('dismissed_at', null)
      .order('sent_at', { ascending: true });

    return data || [];
  }

  /**
   * Mark nudge as opened
   */
  async markNudgeOpened(nudgeId: string): Promise<void> {
    await this.supabase
      .from('nudges')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', nudgeId);
  }

  /**
   * Dismiss nudge
   */
  async dismissNudge(nudgeId: string): Promise<void> {
    await this.supabase
      .from('nudges')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', nudgeId);
  }

  /**
   * Get nudge statistics for a user
   */
  async getNudgeStats(userId: string, days: number = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await this.supabase
      .from('nudges')
      .select('channel')
      .eq('user_id', userId)
      .gte('sent_at', startDate.toISOString());

    const stats = {
      total: data?.length || 0,
      by_channel: {
        email: 0,
        slack: 0,
        teams: 0,
      },
    };

    if (data) {
      for (const nudge of data) {
        stats.by_channel[nudge.channel as keyof typeof stats.by_channel]++;
      }
    }

    return stats;
  }

  /**
   * Generate nudge message for overdue task
   */
  generateNudgeMessage(taskDescription: string, daysOverdue: number, owner: string): string {
    if (daysOverdue === 0) {
      return `📋 Reminder: "${taskDescription}" is due today.\nAssigned to: ${owner}`;
    } else if (daysOverdue === 1) {
      return `⚠️ Alert: "${taskDescription}" was due yesterday.\nAssigned to: ${owner}`;
    }
    return `🚨 Urgent: "${taskDescription}" is ${daysOverdue} days overdue.\nAssigned to: ${owner}`;
  }
}
