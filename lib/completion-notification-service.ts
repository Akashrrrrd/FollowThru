import { createClient } from '@supabase/supabase-js';
import { getEmailProvider } from './email-provider';
import { Anthropic } from '@anthropic-ai/sdk';

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
  private emailProvider = getEmailProvider();
  private claudeClient: Anthropic | null;

  constructor(supabase: any) {
    this.supabase = supabase;
    // Initialize Claude client only if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.claudeClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    } else {
      this.claudeClient = null;
    }
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
   * Auto-detect or infer responsible person from task metadata
   */
  async inferResponsiblePerson(taskId: string, userId: string): Promise<ResponsiblePerson | null> {
    // First check if one is already saved
    const existing = await this.getResponsiblePerson(taskId);
    if (existing) return existing;

    // Try to infer from task owner or meeting context
    // For now, return null and let the API caller explicitly set it
    return null;
  }

  /**
   * Generate completion email using Claude AI
   */
  async generateCompletionEmail(
    taskDescription: string,
    owner: string,
    meetingContext: string,
    sourceQuote: string,
    recipientName: string,
    completionDate: string,
  ): Promise<{ subject: string; body: string }> {
    // If Claude is not available, use fallback template
    if (!this.claudeClient) {
      return this.generateFallbackCompletionEmail(
        taskDescription,
        owner,
        meetingContext,
        sourceQuote,
        recipientName,
        completionDate,
      );
    }

    try {
      const prompt = `
You are a professional business communication assistant. Generate a professional and warm completion confirmation email.

Task Details:
- Task: ${taskDescription}
- Owner: ${owner}
- Completed on: ${completionDate}
- Original Meeting Context: ${meetingContext}
- Original Commitment Quote: "${sourceQuote}"
- Recipient: ${recipientName}

Generate a professional email that:
1. Confirms the task completion with appreciation
2. References the original commitment
3. Mentions the meeting context naturally
4. Is warm but professional in tone
5. Is concise (2-3 short paragraphs)

Format your response as JSON with keys "subject" and "body".
`;

      const message = await this.claudeClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return {
            subject: parsed.subject || `Completion Confirmation: ${taskDescription.substring(0, 50)}...`,
            body: parsed.body || this.generateFallbackCompletionEmail(
              taskDescription,
              owner,
              meetingContext,
              sourceQuote,
              recipientName,
              completionDate,
            ).body,
          };
        } catch {
          // If JSON parsing fails, fallback to template
          return this.generateFallbackCompletionEmail(
            taskDescription,
            owner,
            meetingContext,
            sourceQuote,
            recipientName,
            completionDate,
          );
        }
      }

      return this.generateFallbackCompletionEmail(
        taskDescription,
        owner,
        meetingContext,
        sourceQuote,
        recipientName,
        completionDate,
      );
    } catch (err) {
      console.error('Claude API error in email generation:', err);
      // Fallback to template on error
      return this.generateFallbackCompletionEmail(
        taskDescription,
        owner,
        meetingContext,
        sourceQuote,
        recipientName,
        completionDate,
      );
    }
  }

  /**
   * Fallback email template (used when Claude unavailable)
   */
  private generateFallbackCompletionEmail(
    taskDescription: string,
    owner: string,
    meetingContext: string,
    sourceQuote: string,
    recipientName: string,
    completionDate: string,
  ): { subject: string; body: string } {
    const subject = `Completion Confirmation: ${taskDescription.substring(0, 50)}${taskDescription.length > 50 ? '...' : ''}`;

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
    const updateData: Record<string, any> = {};
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.emailBody !== undefined) updateData.email_body = updates.emailBody;

    await this.supabase
      .from('completion_notifications')
      .update(updateData)
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
    if (!notification) throw new Error('Notification not found or not in draft status');

    // Send email via provider (Resend or Console)
    const emailSent = await this.emailProvider.send(
      notification.recipient_email,
      notification.subject,
      notification.email_body,
    );

    // Update status based on send result
    await this.supabase
      .from('completion_notifications')
      .update({
        status: emailSent ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (!emailSent) {
      throw new Error('Failed to send email');
    }
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

  /**
   * Auto-create completion notification when task is marked complete
   * This is called from the task update endpoint when status changes to 'completed'
   */
  async autoCreateCompletionNotification(
    taskId: string,
    userId: string,
  ): Promise<string | null> {
    try {
      // Get task details
      const { data: task } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!task) return null;

      // Try to get responsible person (if none set, infer from owner or return null)
      let responsible = await this.getResponsiblePerson(taskId);
      if (!responsible) {
        // TODO: Implement logic to infer from owner or task context
        // For now, just return null to let the user explicitly add one
        return null;
      }

      // Get meeting context for email
      let meetingContext = 'Commitment from meeting';
      let sourceQuote = task.source_quote || task.description;

      if (task.meeting_id) {
        const { data: meeting } = await this.supabase
          .from('meetings')
          .select('topic')
          .eq('id', task.meeting_id)
          .single();

        if (meeting?.topic) {
          meetingContext = `From meeting: ${meeting.topic}`;
        }

        // Try to get evidence with quote
        const { data: evidence } = await this.supabase
          .from('commitment_evidence')
          .select('quote')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (evidence?.quote) {
          sourceQuote = evidence.quote;
        }
      }

      // Generate email using AI
      const { subject, body } = await this.generateCompletionEmail(
        task.description,
        task.owner,
        meetingContext,
        sourceQuote,
        responsible.name,
        new Date().toLocaleDateString('en-US'),
      );

      // Create draft notification
      const notificationId = await this.createDraftNotification(
        taskId,
        responsible.email,
        responsible.name,
        subject,
        body,
      );

      return notificationId;
    } catch (err) {
      console.error('Error auto-creating completion notification:', err);
      return null;
    }
  }
}
