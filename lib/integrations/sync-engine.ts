import {
  MONDAY_API_VERSION,
  bearer,
  jsonInit,
  requestJson,
  type SyncProvider,
} from './providers';

/** Tolerance between app-clock and DB-clock when comparing updated_at vs synced_at. */
export const CLOCK_SKEW_MS = 5000;

export interface ExternalTask {
  source: string; // `${provider}:${externalRef}`
  description: string;
  owner: string;
  due_date: string | null; // YYYY-MM-DD
  status: string; // open | in_progress | blocked | completed
  updatedAt: Date;
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Small helpers (also used by bidirectional-sync)
// ---------------------------------------------------------------------------

function toDate(v: unknown): Date {
  if (v == null || v === '') return new Date(0);
  if (typeof v === 'number') return new Date(v);
  const s = String(v);
  if (/^\d{10,}$/.test(s)) return new Date(Number(s)); // epoch millis as string (ClickUp)
  const d = new Date(s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); // Jira: +0000 -> +00:00
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function normalizeDueDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = toDate(value);
  return d.getTime() === 0 ? null : d.toISOString().slice(0, 10);
}

export function mapJiraStatus(status?: { name?: string; statusCategory?: { key?: string } }): string {
  if (status?.name?.toLowerCase() === 'blocked') return 'blocked';
  switch (status?.statusCategory?.key) {
    case 'done':
      return 'completed';
    case 'indeterminate':
      return 'in_progress';
    default:
      return 'open';
  }
}

function mapMondayStatus(text?: string | null): string {
  const s = (text || '').toLowerCase();
  if (/done|complete/.test(s)) return 'completed';
  if (/stuck|block/.test(s)) return 'blocked';
  if (/working|progress/.test(s)) return 'in_progress';
  return 'open';
}

function mapClickUpStatus(status?: { status?: string; type?: string }): string {
  const type = (status?.type || '').toLowerCase();
  const name = (status?.status || '').toLowerCase();
  if (type === 'done' || type === 'closed' || /complete|done|closed/.test(name)) return 'completed';
  if (/block/.test(name)) return 'blocked';
  if (/progress|review/.test(name)) return 'in_progress';
  return 'open';
}

// ---------------------------------------------------------------------------
// Pull (external -> normalized tasks)
// ---------------------------------------------------------------------------

async function pullJira(token: string, metadata: Record<string, any>): Promise<ExternalTask[]> {
  const cloudId = metadata.cloudId;
  if (!cloudId) throw new Error('Jira site not found. Please disconnect and reconnect Jira.');

  const base = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  const jql = 'assignee = currentUser() AND updated >= -90d ORDER BY updated DESC';
  const out: ExternalTask[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      jql,
      fields: 'summary,status,assignee,duedate,updated',
      maxResults: '100',
    });
    if (nextPageToken) params.set('nextPageToken', nextPageToken);

    const data = await requestJson<any>(`${base}/search/jql?${params}`, { headers: bearer(token) }, 'Jira search');

    for (const issue of data.issues ?? []) {
      out.push({
        source: `jira:${issue.key}`,
        description: issue.fields.summary,
        owner: issue.fields.assignee?.displayName || 'Unassigned',
        due_date: normalizeDueDate(issue.fields.duedate),
        status: mapJiraStatus(issue.fields.status),
        updatedAt: toDate(issue.fields.updated),
      });
    }

    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }
  return out;
}

async function pullAsana(token: string): Promise<ExternalTask[]> {
  const headers = bearer(token);
  const me = await requestJson<any>(
    'https://app.asana.com/api/1.0/users/me?opt_fields=workspaces.gid',
    { headers },
    'Asana profile',
  );
  const completedSince = new Date(Date.now() - 90 * DAY_MS).toISOString();
  const out: ExternalTask[] = [];

  for (const ws of (me.data?.workspaces ?? []).slice(0, 5)) {
    let offset: string | undefined;
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({
        assignee: 'me',
        workspace: ws.gid, // Asana requires a workspace when assignee=me
        completed_since: completedSince, // incomplete tasks + recently completed
        limit: '100',
        opt_fields: 'name,completed,due_on,modified_at,assignee.name',
      });
      if (offset) params.set('offset', offset);

      const data = await requestJson<any>(`https://app.asana.com/api/1.0/tasks?${params}`, { headers }, 'Asana tasks');

      for (const t of data.data ?? []) {
        out.push({
          source: `asana:${t.gid}`,
          description: t.name,
          owner: t.assignee?.name || 'Unassigned',
          due_date: normalizeDueDate(t.due_on),
          status: t.completed ? 'completed' : 'open',
          updatedAt: toDate(t.modified_at),
        });
      }
      offset = data.next_page?.offset;
      if (!offset) break;
    }
  }
  return out;
}

async function pullMonday(token: string): Promise<ExternalTask[]> {
  const query = `query {
    me { name }
    boards(limit: 25, state: active) {
      id
      items_page(limit: 100) {
        items { id name state updated_at column_values { type text } }
      }
    }
  }`;

  const data = await requestJson<any>(
    'https://api.monday.com/v2',
    jsonInit({ query }, { Authorization: token, 'API-Version': MONDAY_API_VERSION }),
    'Monday query',
  );
  if (data?.errors?.length) throw new Error(`Monday query failed: ${data.errors[0].message}`);

  const myName: string = data.data?.me?.name ?? '';
  const out: ExternalTask[] = [];

  for (const board of data.data?.boards ?? []) {
    for (const item of board.items_page?.items ?? []) {
      if (item.state && item.state !== 'active') continue;

      const cols: Array<{ type: string; text: string | null }> = item.column_values ?? [];
      const people = cols.find((c) => c.type === 'people' || c.type === 'multiple-person')?.text ?? '';
      if (!myName || !people.includes(myName)) continue; // only items assigned to me

      out.push({
        source: `monday:${board.id}:${item.id}`, // board id is needed for updates
        description: item.name,
        owner: people || myName,
        due_date: normalizeDueDate(cols.find((c) => c.type === 'date')?.text),
        status: mapMondayStatus(cols.find((c) => c.type === 'status')?.text),
        updatedAt: toDate(item.updated_at),
      });
    }
  }
  return out;
}

async function pullClickUp(token: string, metadata: Record<string, any>): Promise<ExternalTask[]> {
  const headers = { Authorization: token };
  const userId =
    metadata.userId ??
    (await requestJson<any>('https://api.clickup.com/api/v2/user', { headers }, 'ClickUp profile')).user?.id;
  if (!userId) throw new Error('Could not determine ClickUp user.');

  const teams = (await requestJson<any>('https://api.clickup.com/api/v2/team', { headers }, 'ClickUp teams')).teams ?? [];
  const since = String(Date.now() - 90 * DAY_MS);
  const out: ExternalTask[] = [];

  for (const team of teams.slice(0, 5)) {
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({
        'assignees[]': String(userId),
        include_closed: 'true',
        subtasks: 'true',
        date_updated_gt: since,
        page: String(page),
      });
      const data = await requestJson<any>(
        `https://api.clickup.com/api/v2/team/${team.id}/task?${params}`,
        { headers },
        'ClickUp tasks',
      );
      const tasks = data.tasks ?? [];

      for (const t of tasks) {
        out.push({
          source: `clickup:${t.id}`,
          description: t.name,
          owner: t.assignees?.[0]?.username || 'Unassigned',
          due_date: normalizeDueDate(t.due_date ? Number(t.due_date) : null),
          status: mapClickUpStatus(t.status),
          updatedAt: toDate(t.date_updated),
        });
      }
      if (tasks.length === 0 || data.last_page) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class SyncEngine {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async startSync(userId: string, provider: string, organizationId?: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .insert({ user_id: userId, provider, status: 'pending', organization_id: organizationId })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  async updateSyncStatus(
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    itemsSynced?: number,
    error?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === 'running') update.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') update.completed_at = new Date().toISOString();
    if (itemsSynced !== undefined) update.items_synced = itemsSynced;
    if (error) update.error_message = error;

    await this.supabase.from('sync_jobs').update(update).eq('id', jobId);
  }

  async getSyncHistory(userId: string, limit: number = 10): Promise<any[]> {
    const { data } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  /** Fetch the user's tasks from the external platform. */
  async pullFromProvider(
    provider: SyncProvider,
    accessToken: string,
    metadata: Record<string, any> = {},
  ): Promise<ExternalTask[]> {
    switch (provider) {
      case 'jira':
        return pullJira(accessToken, metadata);
      case 'asana':
        return pullAsana(accessToken);
    }
  }

  /**
   * Create/update one local task from an external one.
   *
   * `synced_at` = last time local and external were known to match.
   *  - external changed  <=> external.updatedAt > synced_at
   *  - local changed     <=> updated_at > synced_at (+ clock skew)
   * If both changed, last-write-wins; if local wins we skip and the push step sends it.
   * 
   * Also detects completion transitions (incomplete → completed) and returns metadata.
   */
  async upsertExternalTask(
    userId: string,
    ext: ExternalTask,
    organizationId?: string,
  ): Promise<{ result: 'created' | 'updated' | 'skipped'; completionTransition?: boolean; taskId?: string }> {
    const now = new Date().toISOString();
    const fields = {
      description: ext.description,
      owner: ext.owner,
      due_date: ext.due_date,
      status: ext.status,
    };

    const { data: existing, error } = await this.supabase
      .from('tasks')
      .select('id, updated_at, synced_at, status')
      .eq('user_id', userId)
      .eq('source', ext.source)
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    // Detect completion transition: previous status was incomplete, new status is completed
    let completionTransition = false;

    if (!existing) {
      const { data: inserted, error: insertError } = await this.supabase
        .from('tasks')
        .insert({ user_id: userId, organization_id: organizationId, source: ext.source, ...fields, updated_at: now, synced_at: now })
        .select('id')
        .single();
      if (insertError) throw insertError;
      return { result: 'created', taskId: inserted?.id };
    }

    const syncedAt = existing.synced_at ? toDate(existing.synced_at).getTime() : 0;
    const localAt = toDate(existing.updated_at).getTime();
    const externalAt = ext.updatedAt.getTime();

    if (externalAt <= syncedAt) return { result: 'skipped' }; // nothing new externally
    const localChanged = localAt > syncedAt + CLOCK_SKEW_MS;
    if (localChanged && localAt >= externalAt) return { result: 'skipped' }; // local is newer -> push step handles it

    // COMPLETION DETECTION: Did status change from incomplete → completed?
    const oldStatus = existing.status as string;
    const newStatus = ext.status;
    const isIncomplete = (s: string) => s !== 'completed' && s !== 'done';
    if (isIncomplete(oldStatus) && !isIncomplete(newStatus)) {
      completionTransition = true;
    }

    const { error: updateError } = await this.supabase
      .from('tasks')
      .update({
        ...fields,
        updated_at: now,
        synced_at: now,
        ...(completionTransition && { completed_at: now }),
      })
      .eq('id', existing.id);
    if (updateError) throw updateError;

    return { result: 'updated', completionTransition, taskId: existing.id };
  }

  /** Apply a batch; returns { changed, completions: [{ taskId, userId }] }. */
  async applyExternalTasks(
    userId: string,
    tasks: ExternalTask[],
    organizationId?: string,
  ): Promise<{ changed: number; completions: Array<{ taskId: string; userId: string }> }> {
    let changed = 0;
    const completions: Array<{ taskId: string; userId: string }> = [];

    for (const task of tasks) {
      const upsertResult = await this.upsertExternalTask(userId, task, organizationId);
      if (upsertResult.result !== 'skipped') {
        changed++;
      }
      // Track completion transitions
      if (upsertResult.completionTransition && upsertResult.taskId) {
        completions.push({ taskId: upsertResult.taskId, userId });
      }
    }
    return { changed, completions };
  }

  /** Back-compat wrapper for code that imports a single task from a provider. */
  async syncTaskFromProvider(
    userId: string,
    provider: string,
    externalTaskId: string,
    taskData: any,
  ): Promise<string> {
    const source = `${provider}:${externalTaskId}`;
    await this.upsertExternalTask(userId, {
      source,
      description: taskData.title || taskData.name,
      owner: taskData.assignee || 'Unassigned',
      due_date: normalizeDueDate(taskData.dueDate),
      status: taskData.status || 'open',
      updatedAt: toDate(taskData.updatedAt ?? new Date()),
    });
    const { data, error } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('source', source)
      .limit(1)
      .single();
    if (error) throw error;
    return data.id;
  }
}