/**
 * POST /api/cron/email-queue
 *
 * Cron job to process email retry queue.
 * Should be called every 1-5 minutes to retry failed emails with exponential backoff.
 *
 * Runs:
 * - Process pending emails (with retry scheduling)
 * - Clean up old completed emails (retention: 30 days)
 *
 * Requires cron secret in header: X-Cron-Secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { EmailQueueService } from '@/lib/email-queue-service';
import { EmailProvider } from '@/lib/email-provider';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('X-Cron-Secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const emailProvider = EmailProvider.getInstance();
    const emailQueueService = new EmailQueueService(supabase);

    console.info('[Cron] Starting email queue processing');

    // Get queue stats before processing
    const statsBefore = await emailQueueService.getQueueStats();
    console.info('[Cron] Queue stats before:', statsBefore);

    // Process pending emails
    const processedCount = await emailQueueService.processQueue(emailProvider, 50);

    // Clean up old emails
    const cleanedCount = await emailQueueService.cleanup(30);

    // Get queue stats after processing
    const statsAfter = await emailQueueService.getQueueStats();
    console.info('[Cron] Queue stats after:', statsAfter);

    return NextResponse.json({
      success: true,
      message: 'Email queue processing completed',
      result: {
        processed: processedCount,
        cleaned: cleanedCount,
        queueStats: statsAfter,
      },
    });
  } catch (err) {
    console.error('[Cron] Email queue processing failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Email queue processing failed',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
