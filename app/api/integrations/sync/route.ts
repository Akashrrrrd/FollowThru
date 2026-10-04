import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { BidirectionalSyncService } from '@/lib/integrations/bidirectional-sync';
import { OAuthManager, type IntegrationRow } from '@/lib/integrations/oauth-manager';
import { SyncEngine } from '@/lib/integrations/sync-engine';
import { CompletionNotificationService } from '@/lib/completion-notification-service';
import { SYNC_PROVIDERS, errorMessage, isSyncProvider } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs every 15 minutes. For each connected integration:
 *   1. refresh the token if needed
 *   2. pull external tasks into FollowThru   (external -> FollowThru)
 *   3. trigger completion notifications for tasks that just completed
 *   4. push locally-modified tasks back out  (FollowThru -> external)
 * 
 * Error handling strategy:
 * - Individual integration failures don't stop other integrations
 * - Individual task completions that fail don't stop the sync
 * - Completion notification errors are logged but don't block sync
 * - API failures are caught and logged without exposing tokens
 * 
 * Vercel Cron calls GET; external schedulers can use POST. Both need the secret.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const oauth = new OAuthManager(supabase);
    const engine = new SyncEngine(supabase);
    const bidirectional = new BidirectionalSyncService(supabase);
    const completionService = new CompletionNotificationService(supabase);

    const { data: rows, error: fetchError } = await supabase
      .from('integration_clients')
      .select('id, user_id, provider, access_token, refresh_token, expires_at, metadata, last_synced, organization_id')
      .in('provider', [...SYNC_PROVIDERS])
      .not('access_token', 'is', null);
    if (fetchError) throw fetchError;

    const results: Array<Record<string, unknown>> = [];

    for (const row of (rows ?? []) as (IntegrationRow & { organization_id?: string})[]) {
      if (!isSyncProvider(row.provider)) continue;
      let jobId: string | null = null;

      try {
        jobId = await engine.startSync(row.user_id, row.provider, row.organization_id);
        await engine.updateSyncStatus(jobId, 'running');

        let token: string;
        try {
          token = await oauth.getValidAccessToken(row);
        } catch (tokenErr) {
          console.error(`[sync] Token refresh failed for ${row.provider}:`, tokenErr);
          throw new Error(`Failed to refresh token for ${row.provider}`);
        }

        let external: any[];
        try {
          external = await engine.pullFromProvider(row.provider, token, row.metadata ?? {});
        } catch (pullErr) {
          console.error(`[sync] Pull failed for ${row.provider}:`, pullErr);
          throw new Error(`Failed to pull tasks from ${row.provider}`);
        }

        let syncResult;
        try {
          syncResult = await engine.applyExternalTasks(row.user_id, external, row.organization_id);
        } catch (applyErr) {
          console.error(`[sync] Apply failed for ${row.provider}:`, applyErr);
          throw new Error(`Failed to apply tasks for ${row.provider}`);
        }
        const pulled = syncResult.changed;

        // PROCESS COMPLETIONS: Trigger notifications for tasks that just completed
        // Each completion is independently error-handled; failures don't stop sync
        let completionsProcessed = 0;
        let completionErrors = 0;
        for (const completion of syncResult.completions) {
          try {
            const notifId = await completionService.autoCreateAndSendCompletionNotification(
              completion.taskId,
              completion.userId,
            );
            if (notifId) {
              completionsProcessed++;
            }
          } catch (err) {
            completionErrors++;
            console.warn(
              `[sync] Failed to process completion for task ${completion.taskId}:`,
              err instanceof Error ? err.message : String(err),
            );
            // IMPORTANT: Do not re-throw. Continue processing other completions.
          }
        }

        let pushed: number;
        try {
          pushed = await bidirectional.pushPendingChanges(row, token);
        } catch (pushErr) {
          console.error(`[sync] Push failed for ${row.provider}:`, pushErr);
          // Log but don't fail the sync - local changes will retry next cycle
          pushed = 0;
        }

        try {
          await supabase
            .from('integration_clients')
            .update({ last_synced: new Date().toISOString() })
            .eq('id', row.id);
        } catch (updateErr) {
          console.warn(`[sync] Failed to update last_synced for ${row.provider}:`, updateErr);
          // Don't throw - this won't block the result reporting
        }

        try {
          await engine.updateSyncStatus(jobId, 'completed', pulled + pushed);
        } catch (jobErr) {
          console.warn(`[sync] Failed to update sync job status:`, jobErr);
          // Non-critical; don't throw
        }

        const syncResultData: Record<string, unknown> = {
          provider: row.provider,
          status: 'success',
          pulled,
          pushed,
          completions: completionsProcessed,
        };

        if (completionErrors > 0) {
          syncResultData.completionErrors = completionErrors;
        }

        results.push(syncResultData);
      } catch (err) {
        const message = errorMessage(err, 'Unknown error');
        console.error(`[sync] ${row.provider} provider error:`, message);
        if (jobId) {
          try {
            await engine.updateSyncStatus(jobId, 'failed', undefined, message).catch(() => {});
          } catch (statusErr) {
            console.warn(`[sync] Could not update failed job status:`, statusErr);
          }
        }
        results.push({
          provider: row.provider,
          status: 'error',
          error: message,
        });
        // Continue with next provider
      }
    }

    return NextResponse.json({
      total: results.length,
      synced: results.filter((r) => r.status === 'success').length,
      results,
    });
  } catch (error) {
    console.error('[sync] Critical sync error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: errorMessage(error, 'Sync failed') },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;