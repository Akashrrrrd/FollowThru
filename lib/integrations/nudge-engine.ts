import { createClient } from '@supabase/supabase-js';

export class NudgeEngine {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Send nudge for overdue task
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
    return data.id;
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
