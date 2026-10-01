import { createClient } from '@supabase/supabase-js';

interface ResponsiblePerson {
  id: string;
  name: string;
  email: string;
  isFollowthruMember: boolean;
}

interface CompletionNotificationDraft {
  id: string;
  taskId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  emailBody: string;
  status: 'draft' | 'sent' | 'failed';
}

export class CompletionNotificationService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Save responsible person for a task
   */
  async saveResponsiblePerson(
    taskId: string,
    name: string,
    email: string,
    isFollowthruMember: boolean = false,
    userId?: string,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('commitment_responsible_persons')
      .insert({
        task_id: taskId,
        name,
        email,
        is_followthru_member: isFollowthruMember,
        user_id: userId,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Get responsible person for a task
   */
  async getResponsiblePerson(taskId: string): Promise<ResponsiblePerson | null> {
    const { data } = await this.supabase
      .from('commitment_responsible_persons')
      .select('*')
      .eq('task_id', taskId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      isFollowthruMember: data.is_followthru_member,
    };
  }

  /**
   * Generate completion email (AI-ready placeholder)
   */
  async generateCompletionEmail(
    taskDescription: string,
    owner: string,
    meetingContext: string,
    sourceQuote: string,
    recipientName: string,
    completionDate: string,
  ): Promise<{ subject: string; body: string }> {
    // This is a template. Real implementation would call OpenAI/Claude API
    const subject = `Completion Confirmation: ${taskDescription.substring(0, 50)}...`;

    const body = `
Dear ${recipientName},

We wanted to confirm that the following commitment has been completed:

**Task:** ${taskDescription}
**Owner:** ${owner}
**Completion Date:** ${completionDate}

**Meeting Context:**
${meetingContext}

**Original Commitment:**
"${sourceQuote}"

Thank you for your attention to this matter.

Best regards,
FollowThru Team
    `.trim();

    return { subject, body };
  }

  /**
   * Create draft notification (NOT sent yet)
   */
  async createDraftNotification(
    taskId: string,
    recipientEmail: string,
    recipientName: string,
    subject: string,
    emailBody: string,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('completion_notifications')
      .insert({
        task_id: taskId,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        subject,
        email_body: emailBody,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Update draft notification (for editing before send)
   */
  async updateDraftNotification(
    notificationId: string,
    updates: { subject?: string; emailBody?: string },
  ): Promise<void> {
    await this.supabase
      .from('completion_notifications')
      .update(updates)
      .eq('id', notificationId)
      .eq('status', 'draft');
  }

  /**
   * Send notification (explicit action, NOT automatic)
   */
  async sendNotification(notificationId: string): Promise<void> {
    // Get draft notification
    const { data: notification, error: fetchError } = await this.supabase
      .from('completion_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('status', 'draft')
      .single();

    if (fetchError) throw fetchError;

    // In production, would call SendGrid or similar email service here
    // For now, just mark as sent
    await this.supabase
      .from('completion_notifications')
      .update({
        status: 'sent',
        sent_at: new Date(),
      })
      .eq('id', notificationId);
  }

  /**
   * Get notification history for a task
   */
  async getNotificationHistory(taskId: string): Promise<CompletionNotificationDraft[]> {
    const { data } = await this.supabase
      .from('completion_notifications')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    return (data || []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      recipientEmail: row.recipient_email,
      recipientName: row.recipient_name,
      subject: row.subject,
      emailBody: row.email_body,
      status: row.status,
    }));
  }

  /**
   * Get draft notifications pending send
   */
  async getDraftNotifications(taskId: string): Promise<CompletionNotificationDraft[]> {
    const { data } = await this.supabase
      .from('completion_notifications')
      .select('*')
      .eq('task_id', taskId)
      .eq('status', 'draft');

    return (data || []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      recipientEmail: row.recipient_email,
      recipientName: row.recipient_name,
      subject: row.subject,
      emailBody: row.email_body,
      status: row.status,
    }));
  }
}
