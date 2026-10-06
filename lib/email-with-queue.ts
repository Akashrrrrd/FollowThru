/**
 * Email Service with Queue Integration
 *
 * Wraps the email provider to optionally queue emails instead of sending immediately.
 * Used in request handlers to enqueue instead of blocking on email delivery.
 *
 * Usage:
 *  // For immediate send (still works):
 *  await emailService.send({ to, subject, html });
 *
 *  // For queued send (non-blocking):
 *  await emailService.enqueue({ to, subject, html });
 *  await emailService.enqueue({ to, subject, html, idempotentKey: 'unique-id' });
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EmailProvider, type EmailOptions, type IEmailProvider } from '@/lib/email-provider';
import { EmailQueueService, type EnqueueEmailOptions } from '@/lib/email-queue-service';

export class EmailWithQueue {
  private emailProvider: IEmailProvider;
  private emailQueueService: EmailQueueService;

  constructor(supabase: SupabaseClient) {
    this.emailProvider = EmailProvider.getInstance();
    this.emailQueueService = new EmailQueueService(supabase);
  }

  /**
   * Send email immediately (blocking).
   * Use this for critical emails that must complete before returning.
   */
  async send(options: EmailOptions): Promise<void> {
    return this.emailProvider.send(options);
  }

  /**
   * Queue email for delivery with retry logic (non-blocking).
   * Returns immediately; actual delivery happens via cron job.
   * Perfect for notifications where retry is acceptable.
   */
  async enqueue(options: EnqueueEmailOptions): Promise<boolean> {
    try {
      const result = await this.emailQueueService.enqueueEmail(options);
      return result !== null; // true if enqueued, false if bounced
    } catch (err) {
      console.error('[EmailWithQueue] Failed to enqueue email:', err);
      throw err;
    }
  }

  /**
   * Send immediately with fallback to queue on failure.
   * Tries immediate delivery first; if it fails, queues for retry.
   */
  async sendWithFallback(options: EmailOptions & Partial<EnqueueEmailOptions>): Promise<void> {
    try {
      // Try immediate send
      await this.emailProvider.send(options);
      console.info(`[EmailWithQueue] Sent immediately to ${options.to}`);
    } catch (err) {
      console.warn(
        `[EmailWithQueue] Immediate send failed for ${options.to}, queuing for retry:`,
        err
      );

      // Fall back to queue
      try {
        const queued = await this.emailQueueService.enqueueEmail({
          recipientEmail: options.to,
          subject: options.subject,
          htmlBody: options.html,
          textBody: options.text,
          maxRetries: options.maxRetries || 3,
          idempotentKey: options.idempotentKey,
          metadata: options.metadata,
        });

        if (!queued) {
          throw new Error('Email bounced or already queued');
        }

        console.info(`[EmailWithQueue] Queued for retry: ${options.to}`);
      } catch (queueErr) {
        console.error('[EmailWithQueue] Failed to queue email:', queueErr);
        throw queueErr;
      }
    }
  }
}

// Singleton instance
let instance: EmailWithQueue | null = null;

export function getEmailWithQueue(supabase: SupabaseClient): EmailWithQueue {
  if (!instance) {
    instance = new EmailWithQueue(supabase);
  }
  return instance;
}
