import { OAuthManager, type IntegrationRow } from './oauth-manager';
import { CLOCK_SKEW_MS, mapJiraStatus, normalizeDueDate } from './sync-engine';
import {
  MONDAY_API_VERSION,
  bearer,
  isSyncProvider,
  jsonInit,
  requestJson,
  type SyncProvider,
} from './providers';

const CLICKUP_STATUS: Record<string, string> = {
  open: 'to do',
  in_progress: 'in progress',
  blocked: 'blocked',
  completed: 'complete',
};

/**
 * Pushes FollowThru task changes back to Jira / Asana / Monday / ClickUp.
 * Token refresh lives in OAuthManager.getValidAccessToken().
 */
export class BidirectionalSyncService {
  private supabase: any;
  private oauth: OAuthManager;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.oauth = new OAuthManager(supabase);
  }

  /**
   * Push every locally-modified task for one integration. Returns how many were pushed.
   * A task is "modified" when updated_at is newer than synced_at.
   */
  async pushPendingChanges(integration: IntegrationRow, accessToken: string): Promise<number> {
    if (!isSyncProvider(integration.provider)) return 0;
    const provider = integration.provider;

    const { data: tasks, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', integration.user_id)
      .like('source', `${provider}:%`);
    if (error) throw error;

    const dirty = (tasks ?? []).filter((t: any) => {
      const updated = Date.parse(t.updated_at);
      const synced = t.synced_at ? Date.parse(t.synced_at) : 0;
      return Number.isFinite(updated) && updated > synced + CLOCK_SKEW_MS;
    });

    let pushed = 0;
    for (const task of dirty) {
      try {
        await this.pushTask(provider, accessToken, integration.metadata ?? {}, task);
        await this.supabase.from('tasks').update({ synced_at: new Date().toISOString() }).eq('id', task.id);
        pushed++;
      } catch (err) {
        // Leave the task dirty so the next cycle retries it.
        console.error(`[sync] push to ${provider} failed for task ${task.id}:`, err);
      }
    }
    return pushed;
  }

  /** Push a single task (e.g. right after a user edits it). Never throws. */
  async syncTaskToProvider(userId: string, provider: string, task: any): Promise<void> {
    try {
      if (!isSyncProvider(provider)) return;
      const integration = await this.oauth.getCredentials(userId, provider);
      if (!integration?.access_token) {
        console.log(`No ${provider} integration found for user ${userId}`);
        return;
      }
      const token = await this.oauth.getValidAccessToken(integration);
      await this.pushTask(provider, token, integration.metadata ?? {}, task);
      await this.supabase.from('tasks').update({ synced_at: new Date().toISOString() }).eq('id', task.id);
    } catch (err) {
      console.error(`Error syncing task to ${provider}:`, err); // don't break the caller's flow
    }
  }

  private async pushTask(provider: SyncProvider, token: string, metadata: Record<string, any>, task: any) {
    const sep = typeof task.source === 'string' ? task.source.indexOf(':') : -1;
    const ref = sep >= 0 ? task.source.slice(sep + 1) : '';
    if (!ref) return; // not an external task

    switch (provider) {
      case 'jira':
        return this.pushJira(token, metadata, ref, task);
      case 'asana':
        return this.pushAsana(token, ref, task);
    }
  }

  // --- Jira: fields via PUT, status via transitions ---
  private async pushJira(token: string, metadata: Record<string, any>, issueKey: string, task: any) {
    const cloudId = metadata.cloudId;
    if (!cloudId) throw new Error('Missing Jira cloudId. Reconnect Jira.');

    const base = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
    const headers = { ...bearer(token), 'Content-Type': 'application/json' };

    const fields: Record<string, unknown> = { duedate: normalizeDueDate(task.due_date) };
    if (task.description) fields.summary = task.description;
    await requestJson(base, { method: 'PUT', headers, body: JSON.stringify({ fields }) }, 'Jira update');

    // Status can't be set through the edit endpoint; it needs a workflow transition.
    const current = await requestJson<any>(`${base}?fields=status`, { headers }, 'Jira status lookup');
    if (mapJiraStatus(current?.fields?.status) === task.status) return;

    const { transitions = [] } = await requestJson<any>(`${base}/transitions`, { headers }, 'Jira transitions');
    const match = transitions.find((t: any) => {
      const category = t.to?.statusCategory?.key;
      const name = String(t.to?.name || '').toLowerCase();
      switch (task.status) {
        case 'completed':
          return category === 'done';
        case 'in_progress':
          return category === 'indeterminate' && name !== 'blocked';
        case 'blocked':
          return name === 'blocked';
        default:
          return category === 'new';
      }
    });
    if (match) {
      await requestJson(
        `${base}/transitions`,
        { method: 'POST', headers, body: JSON.stringify({ transition: { id: match.id } }) },
        'Jira transition',
      );
    }
  }

  // --- Asana: body must be wrapped in { data } ---
  private async pushAsana(token: string, gid: string, task: any) {
    const data: Record<string, unknown> = {
      due_on: normalizeDueDate(task.due_date),
      completed: task.status === 'completed',
    };
    if (task.description) data.name = task.description;

    await requestJson(
      `https://app.asana.com/api/1.0/tasks/${encodeURIComponent(gid)}`,
      {
        method: 'PUT',
        headers: { ...bearer(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      },
      'Asana update',
    );
  }

  // --- Monday: only the item name is pushed (other columns need board-specific column ids) ---
  private async pushMonday(token: string, ref: string, task: any) {
    const [boardId, itemId] = ref.split(':');
    if (!boardId || !itemId) throw new Error(`Invalid Monday reference "${ref}"`);
    if (!task.description) return;

    const mutation = `mutation ($board: ID!, $item: ID!, $value: String!) {
      change_simple_column_value(board_id: $board, item_id: $item, column_id: "name", value: $value) { id }
    }`;
    const res = await requestJson<any>(
      'https://api.monday.com/v2',
      jsonInit(
        { query: mutation, variables: { board: boardId, item: itemId, value: task.description } },
        { Authorization: token, 'API-Version': MONDAY_API_VERSION },
      ),
      'Monday update',
    );
    if (res?.errors?.length) throw new Error(`Monday update failed: ${res.errors[0].message}`);
  }

  // --- ClickUp: status is sent separately because custom list statuses may not match ---
  private async pushClickUp(token: string, taskId: string, task: any) {
    const url = `https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`;
    const headers = { Authorization: token, 'Content-Type': 'application/json' };

    const due = normalizeDueDate(task.due_date);
    const data: Record<string, unknown> = { due_date: due ? new Date(due).getTime() : null };
    if (task.description) data.name = task.description;
    await requestJson(url, { method: 'PUT', headers, body: JSON.stringify(data) }, 'ClickUp update');

    const status = CLICKUP_STATUS[task.status];
    if (status) {
      try {
        await requestJson(url, { method: 'PUT', headers, body: JSON.stringify({ status }) }, 'ClickUp status update');
      } catch (err) {
        console.warn('[sync] ClickUp status not applied (list may use custom statuses):', err);
      }
    }
  }

  // --- Conflict helpers (kept for callers that use them) ---

  async resolveConflict(
    _taskId: string,
    _provider: string,
    followthruVersion: any,
    externalVersion: any,
  ): Promise<'followthru' | 'external'> {
    const followthruTime = new Date(followthruVersion.updated_at || followthruVersion.created_at).getTime();
    const externalTime = new Date(externalVersion.updated_at || externalVersion.created_at).getTime();
    return externalTime > followthruTime ? 'external' : 'followthru';
  }

  async recordSyncConflict(
    taskId: string,
    provider: string,
    _followthruVersion: any,
    _externalVersion: any,
    resolution: 'followthru' | 'external',
  ): Promise<void> {
    console.log(`[SYNC CONFLICT] Task ${taskId} on ${provider}: resolved with ${resolution} version`);
  }
}