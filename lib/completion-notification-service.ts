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
   * 
   * Strategy:
   * 1. Check if already explicitly saved
   * 2. Try to infer from task owner (if it's an email or matches a user profile)
   * 3. Try owner_user_id if present
   * 4. Return null if cannot be inferred
   */
  async inferResponsiblePerson(taskId: string, userId: string): Promise<ResponsiblePerson | null> {
    // First check if one is already saved
    const existing = await this.getResponsiblePerson(taskId);
    if (existing) return existing;

    try {
      // Fetch task details to extract owner info
      const { data: task, error: taskError } = await this.supabase
        .from('tasks')
        .select('owner, owner_user_id, user_id')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        console.warn(`[completion] Could not fetch task ${taskId} for inference:`, taskError);
        return null;
      }

      // Strategy 1: If owner_user_id is set, fetch their profile
      if (task.owner_user_id) {
        const { data: userProfile, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('id', task.owner_user_id)
          .single();

        if (!profileError && userProfile?.email) {
          return {
            id: userProfile.id,
            name: userProfile.full_name || userProfile.email,
            email: userProfile.email,
            isFollowthruMember: true,
          };
        }
      }

      // Strategy 2: If owner looks like an email, try to find matching user
      if (task.owner && task.owner.includes('@')) {
        const { data: userProfile, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('email', task.owner)
          .single();

        if (!profileError && userProfile?.email) {
          return {
            id: userProfile.id,
            name: userProfile.full_name || userProfile.email,
            email: userProfile.email,
            isFollowthruMember: true,
          };
        }
      }

      // Strategy 3: If owner is a name and creator is a FollowThru member, use creator's email
      // (assuming task creator wants to be notified of their tasks' completion)
      const { data: creatorProfile, error: creatorError } = await this.supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('id', task.user_id)
        .single();

      if (!creatorError && creatorProfile?.email) {
        // Save this inference for future use
        await this.saveResponsiblePerson(taskId, creatorProfile.full_name || creatorProfile.email, creatorProfile.email, true, creatorProfile.id).catch((err) => {
          console.warn(`[completion] Could not save inferred responsible person:`, err);
        });

        return {
          id: creatorProfile.id,
          name: creatorProfile.full_name || creatorProfile.email,
          email: creatorProfile.email,
          isFollowthruMember: true,
        };
      }

      return null;
    } catch (err) {
      console.warn(`[completion] Error inferring responsible person for task ${taskId}:`, err);
      return null;
    }
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
   * Check if a completion notification has already been sent for this task
   */
  async hasCompletionNotificationBeenSent(taskId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('completion_notifications')
      .select('id')
      .eq('task_id', taskId)
      .eq('status', 'sent')
      .limit(1)
      .single();

    return !error && !!data;
  }

  /**
   * Auto-create and send completion notification (with Slack support)
   * 
   * This is called when a task is completed externally (via sync).
   * It combines auto-creation with automatic sending (unlike the manual flow).
   * 
   * Returns the notification ID if successful, null otherwise.
   * Includes duplicate prevention: won't send twice for the same task.
   */
  async autoCreateAndSendCompletionNotification(
    taskId: string,
    userId: string,
  ): Promise<string | null> {
    try {
      // DUPLICATE PREVENTION: Check if notification already sent
      const alreadySent = await this.hasCompletionNotificationBeenSent(taskId);
      if (alreadySent) {
        console.log(`[completion] Notification already sent for task ${taskId}, skipping`);
        return null;
      }

      // Get task details
      const { data: task, error: taskError } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        console.warn(`[completion] Could not fetch task ${taskId}:`, taskError);
        return null;
      }

      // Try to get or infer responsible person
      let responsible = await this.getResponsiblePerson(taskId);
      if (!responsible) {
        responsible = await this.inferResponsiblePerson(taskId, userId);
      }

      if (!responsible) {
        console.log(`[completion] No responsible person for task ${taskId}, skipping notification`);
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
        task.owner || 'Unknown',
        meetingContext,
        sourceQuote,
        responsible.name,
        new Date().toLocaleDateString('en-US'),
      );

      // Create draft notification (will be marked as sent after email sent)
      const notificationId = await this.createDraftNotification(
        taskId,
        responsible.email,
        responsible.name,
        subject,
        body,
      );

      // Try to send email
      let emailSent = false;
      try {
        emailSent = await this.emailProvider.send(responsible.email, subject, body);
        if (emailSent) {
          await this.supabase
            .from('completion_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', notificationId);
          console.log(`[completion] Email sent for task ${taskId} to ${responsible.email}`);
        }
      } catch (emailErr) {
        console.warn(`[completion] Email send failed for task ${taskId}:`, emailErr);
        // Don't fail the whole flow; Slack notification can still be sent
      }

      // Try to send Slack completion message (if user has Slack configured)
      try {
        const completionDetails = `Originally committed as: "${sourceQuote}"\n\nCompleted: ${new Date().toLocaleString()}`;
        await this.sendSlackCompletionMessage(userId, task.description, completionDetails);
        console.log(`[completion] Slack message sent for task ${taskId} to user ${userId}`);
      } catch (slackErr) {
        console.warn(`[completion] Slack message failed for task ${taskId}:`, slackErr);
        // Don't fail if Slack is not available
      }

      return notificationId;
    } catch (err) {
      console.error('[completion] Error in autoCreateAndSendCompletionNotification:', err);
      return null;
    }
  }

  /**
   * Send Slack completion message (via injected NudgeEngine)
   * This is called after email is sent to also notify on Slack
   */
  private async sendSlackCompletionMessage(
    userId: string,
    taskDescription: string,
    completionDetails: string,
  ): Promise<void> {
    // Lazy import to avoid circular dependency
    const { NudgeEngine } = await import('./integrations/nudge-engine');
    const nudgeEngine = new NudgeEngine(this.supabase);
    await nudgeEngine.sendSlackCompletionMessage(userId, taskDescription, completionDetails);
  }

  /**
   * Auto-create completion notification when task is marked complete (manual flow)
   * This is called from the task update endpoint when status changes to 'completed'
   * Creates a DRAFT that requires manual send (legacy behavior)
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

      // Try to get or infer responsible person
      let responsible = await this.getResponsiblePerson(taskId);
      if (!responsible) {
        responsible = await this.inferResponsiblePerson(taskId, userId);
      }

      if (!responsible) {
        console.log(`[completion] No responsible person for task ${taskId}, cannot auto-create notification`);
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
