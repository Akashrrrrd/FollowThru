/**
 * Email Queue Service
 *
 * Handles reliable email delivery with exponential backoff retry logic.
 * Decouples email sending from request handling to improve reliability.
 *
 * Usage:
 *  1. Call enqueueEmail() to add email to queue
 *  2. Cron job periodically calls processQueue() to retry pending emails
 *  3. Failed emails are retried with exponential backoff (60s * 2^retry_count)
 *  4. After max_retries exceeded, email marked as failed
 *  5. Bounced/invalid emails tracked to prevent future retry attempts
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface EmailQueueItem {
  id: string;
  recipient_email: string;
  subject: string;
  html_body: string;
  text_body?: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  last_error?: string;
  created_at: string;
  sent_at?: string;
  failed_at?: string;
}

export interface EnqueueEmailOptions {
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  maxRetries?: number;
  idempotentKey?: string;
  metadata?: Record<string, any>;
}

export class EmailQueueService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Add email to queue for delivery.
   * Returns the queued email record.
   */
  async enqueueEmail(options: EnqueueEmailOptions): Promise<EmailQueueItem | null> {
    const {
      recipientEmail,
      subject,
      htmlBody,
      textBody,
      maxRetries = 3,
      idempotentKey,
      metadata = {},
    } = options;

    if (!recipientEmail || !subject || !htmlBody) {
      throw new Error('Missing required email fields: recipientEmail, subject, htmlBody');
    }

    // Check if email is already bounced
    const { data: bounced } = await this.supabase
      .from('bounced_emails')
      .select('id')
      .eq('email', recipientEmail.toLowerCase())
      .maybeSingle();

    if (bounced) {
      console.warn(`[EmailQueue] Skipping bounced email: ${recipientEmail}`);
      return null;
    }

    // Insert into queue
    const { data, error } = await this.supabase
      .from('email_queue')
      .insert({
        recipient_email: recipientEmail.toLowerCase(),
        subject,
        html_body: htmlBody,
        text_body: textBody || null,
        max_retries: maxRetries,
        status: 'pending',
        retry_count: 0,
        next_retry_at: new Date().toISOString(),
        idempotent_key: idempotentKey || null,
        metadata,
      })
      .select()
      .single();

    if (error) {
      // If unique constraint on idempotent_key, that's OK (already queued)
      if (error.code === '23505' && idempotentKey) {
        console.info(`[EmailQueue] Email already queued (idempotent): ${recipientEmail}`);
        return null;
      }
      throw error;
    }

    console.info(`[EmailQueue] Enqueued email to ${recipientEmail} (ID: ${data.id})`);
    return data;
  }

  /**
   * Process pending emails in the queue.
   * Called by cron job (typically every 1-5 minutes).
   * Returns count of emails processed.
   */
  async processQueue(emailProvider: any, batchSize: number = 50): Promise<number> {
    // Fetch pending emails ready for retry
    const now = new Date().toISOString();
    const { data: pending, error: fetchError } = await this.supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', now)
      .limit(batchSize)
      .order('next_retry_at', { ascending: true });

    if (fetchError) {
      console.error('[EmailQueue] Failed to fetch pending emails:', fetchError);
      return 0;
    }

    if (!pending || pending.length === 0) {
      console.debug('[EmailQueue] No pending emails to process');
      return 0;
    }

    console.info(`[EmailQueue] Processing ${pending.length} pending emails`);

    let successCount = 0;
    let failureCount = 0;

    for (const email of pending) {
      try {
        // Attempt to send
        await emailProvider.send({
          to: email.recipient_email,
          subject: email.subject,
          html: email.html_body,
          text: email.text_body,
        });

        // Mark as sent
        await this.supabase
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        console.info(`[EmailQueue] Sent email to ${email.recipient_email}`);
        successCount++;
      } catch (err: any) {
        failureCount++;
        const errorMessage = err?.message || 'Unknown error';

        // Determine if this is a permanent bounce
        const isPermanentBounce =
          errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('not found') ||
          errorMessage.toLowerCase().includes('550') || // SMTP 550 = permanent failure
          errorMessage.toLowerCase().includes('permanent');

        if (isPermanentBounce) {
          // Mark as bounced
          await this.markBounced(email.recipient_email, 'permanent', errorMessage);

          await this.supabase
            .from('email_queue')
            .update({
              status: 'bounced',
              failed_at: new Date().toISOString(),
              last_error: errorMessage,
            })
            .eq('id', email.id);

          console.warn(`[EmailQueue] Marked as bounced: ${email.recipient_email} - ${errorMessage}`);
        } else {
          // Transient error - schedule retry
          const nextRetryCount = email.retry_count + 1;
          const maxRetries = email.max_retries;

          if (nextRetryCount >= maxRetries) {
            // Max retries exceeded
            await this.supabase
              .from('email_queue')
              .update({
                status: 'failed',
                failed_at: new Date().toISOString(),
                last_error: errorMessage,
              })
              .eq('id', email.id);

            console.error(
              `[EmailQueue] Max retries exceeded for ${email.recipient_email}: ${errorMessage}`
            );
          } else {
            // Schedule next retry with exponential backoff
            const backoffMs = 60000 * Math.pow(2, nextRetryCount); // 60s * 2^retry_count
            const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

            await this.supabase
              .from('email_queue')
              .update({
                retry_count: nextRetryCount,
                next_retry_at: nextRetryAt,
                last_error: errorMessage,
              })
              .eq('id', email.id);

            const retryMinutes = Math.round(backoffMs / 60000);
            console.warn(
              `[EmailQueue] Retry #${nextRetryCount} scheduled in ${retryMinutes}min for ${email.recipient_email}: ${errorMessage}`
            );
          }
        }
      }
    }

    console.info(
      `[EmailQueue] Queue processing complete: ${successCount} sent, ${failureCount} failed`
    );
    return successCount;
  }

  /**
   * Mark email address as bounced to prevent future send attempts.
   */
  async markBounced(
    email: string,
    bounceType: 'permanent' | 'transient' = 'permanent',
    reason?: string
  ): Promise<void> {
    const { error } = await this.supabase.from('bounced_emails').insert({
      email: email.toLowerCase(),
      bounce_type: bounceType,
      bounce_reason: reason || null,
    });

    if (error && error.code !== '23505') {
      // 23505 = already bounced (OK)
      console.error('[EmailQueue] Failed to record bounce:', error);
    }
  }

  /**
   * Get email queue statistics.
   */
  async getQueueStats(): Promise<{
    pending: number;
    sent: number;
    failed: number;
    bounced: number;
    oldestPending?: string;
  }> {
    const statuses = ['pending', 'sent', 'failed', 'bounced'] as const;
    const stats: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await this.supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);

      stats[status] = count || 0;
    }

    // Get oldest pending email
    const { data: oldest } = await this.supabase
      .from('email_queue')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    return {
      pending: stats.pending,
      sent: stats.sent,
      failed: stats.failed,
      bounced: stats.bounced,
      oldestPending: oldest?.created_at,
    };
  }

  /**
   * Clean up old completed emails from queue (older than retentionDays).
   * Call periodically to manage database size.
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data } = await this.supabase
      .from('email_queue')
      .delete()
      .eq('status', 'sent')
      .lt('sent_at', cutoffDate.toISOString())
      .select();

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      console.info(`[EmailQueue] Cleaned up ${deletedCount} old sent emails`);
    }

    return deletedCount;
  }
}
