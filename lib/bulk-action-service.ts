/**
 * Bulk Action Service
 *
 * Bulk commitment operations: assign, reassign, status, due_date, priority.
 *
 * - Callers must already have authorized the user (see app/api/commitments/bulk/route.ts).
 * - Every query here is additionally scoped to `organizationId` (defense in depth).
 * - Updates and history inserts are batched (a few queries per action instead of
 *   several queries per commitment).
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type BulkActionType = 'assign' | 'reassign' | 'status' | 'due_date' | 'priority';

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'overdue' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface BulkActionRequest {
  action: BulkActionType;
  commitmentIds: string[];
  value: BulkActionValue;
}

export type BulkActionValue =
  | { targetUserId: string }
  | { newStatus: TaskStatus }
  | { newDueDate: string | null }
  | { newPriority: TaskPriority };

export interface BulkActionFailure {
  commitmentId: string;
  reason: string;
  severity: 'warning' | 'error';
}

export interface BulkActionResult {
  action: BulkActionType;
  totalRequested: number;
  successCount: number;
  failedCount: number;
  successIds: string[];
  failures: BulkActionFailure[];
  resultMetadata: {
    timestamp: string;
    changedByUserId: string;
    organizationId: string;
  };
}

/* ------------------------------ Helpers ------------------------------ */

// Keeps `.in()` URLs short enough for PostgREST / proxies
const CHUNK_SIZE = 100;

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Fetch tasks by id in chunks. Optionally scoped to one organization. */
export async function fetchCommitmentsByIds(
  supabase: SupabaseClient,
  ids: string[],
  columns: string,
  organizationId?: string,
): Promise<{ data: any[]; error: { message: string } | null }> {
  const rows: any[] = [];
  for (const part of chunk(ids)) {
    let query: any = supabase.from('tasks').select(columns).in('id', part);
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}

interface Ctx {
  supabase: SupabaseClient;
  userId: string;
  organizationId: string;
  action: BulkActionType;
  total: number;
  timestamp: string;
  /** Failures known before the action runs (e.g. ids that were not found) */
  baseFailures: BulkActionFailure[];
}

function buildResult(ctx: Ctx, successIds: string[], failures: BulkActionFailure[]): BulkActionResult {
  return {
    action: ctx.action,
    totalRequested: ctx.total,
    successCount: successIds.length,
    failedCount: failures.length,
    successIds,
    failures,
    resultMetadata: {
      timestamp: ctx.timestamp,
      changedByUserId: ctx.userId,
      organizationId: ctx.organizationId,
    },
  };
}

function failAll(ctx: Ctx, commitments: any[], reason: string): BulkActionResult {
  return buildResult(ctx, [], [
    ...ctx.baseFailures,
    ...commitments.map((c) => ({ commitmentId: c.id as string, reason, severity: 'error' as const })),
  ]);
}

interface Plan {
  items: Array<{ id: string; oldValue: string; newValue: string }>;
  skipped: BulkActionFailure[];
  patch: Record<string, unknown>;
  changeType: 'updated' | 'status_changed' | 'date_changed';
  notes: string;
}

/** Apply the same patch to all eligible commitments (batched) and log history. */
async function applyPlan(ctx: Ctx, plan: Plan): Promise<BulkActionResult> {
  const successIds: string[] = [];
  const failures: BulkActionFailure[] = [...ctx.baseFailures, ...plan.skipped];

  for (const part of chunk(plan.items)) {
    const ids = part.map((i) => i.id);

    const { error: updateError } = await ctx.supabase
      .from('tasks')
      .update(plan.patch)
      .in('id', ids)
      .eq('organization_id', ctx.organizationId);

    if (updateError) {
      for (const item of part) {
        failures.push({
          commitmentId: item.id,
          reason: `Update failed: ${updateError.message}`,
          severity: 'error',
        });
      }
      continue;
    }

    successIds.push(...ids);

    const { error: historyError } = await ctx.supabase.from('commitment_history').insert(
      part.map((item) => ({
        task_id: item.id,
        user_id: ctx.userId,
        change_type: plan.changeType,
        old_value: item.oldValue,
        new_value: item.newValue,
        notes: plan.notes,
      })),
    );
    if (historyError) {
      console.error('[bulk-action] Failed to write commitment history:', historyError);
    }
  }

  return buildResult(ctx, successIds, failures);
}

/* ------------------------------ Entry point ------------------------------ */

export async function executeBulkAction(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  request: BulkActionRequest,
): Promise<BulkActionResult> {
  const timestamp = new Date().toISOString();
  const ids = Array.from(new Set(request.commitmentIds)); // duplicates would break counts

  const { data: commitments, error: fetchError } = await fetchCommitmentsByIds(
    supabase,
    ids,
    'id, organization_id, team_id, status, assigned_to_user_id, due_date, priority',
    organizationId,
  );

  if (fetchError) {
    throw new Error(`Failed to fetch commitments: ${fetchError.message}`);
  }

  const foundIds = new Set(commitments.map((c: any) => c.id));
  const baseFailures: BulkActionFailure[] = ids
    .filter((id) => !foundIds.has(id))
    .map((id) => ({
      commitmentId: id,
      reason: 'Commitment not found or not accessible',
      severity: 'error' as const,
    }));

  const ctx: Ctx = {
    supabase,
    userId,
    organizationId,
    action: request.action,
    total: ids.length,
    timestamp,
    baseFailures,
  };

  if (commitments.length === 0) return buildResult(ctx, [], baseFailures);

  const value = (request.value ?? {}) as Record<string, unknown>;

  switch (request.action) {
    case 'assign':
    case 'reassign':
      return handleAssignment(ctx, commitments, typeof value.targetUserId === 'string' ? value.targetUserId : '');
    case 'status':
      return handleStatus(ctx, commitments, value.newStatus as TaskStatus);
    case 'due_date':
      return handleDueDate(ctx, commitments, value.newDueDate as string | null | undefined);
    case 'priority':
      return handlePriority(ctx, commitments, value.newPriority as TaskPriority);
    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

/* ------------------------------ Handlers ------------------------------ */

async function handleAssignment(ctx: Ctx, commitments: any[], targetUserId: string) {
  if (!targetUserId) return failAll(ctx, commitments, 'Missing target user');

  // Target must belong to the same organization
  const { data: targetUser, error: userError } = await ctx.supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (userError || !targetUser) {
    return failAll(ctx, commitments, 'Target user not found in organization');
  }

  // One query: which of the involved teams is the target user a member of?
  const teamIds = Array.from(new Set(commitments.map((c) => c.team_id).filter(Boolean)));
  let memberTeams = new Set<string>();
  if (teamIds.length > 0) {
    const { data: rows, error: teamError } = await ctx.supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', targetUserId)
      .in('team_id', teamIds);

    if (teamError) {
      return failAll(ctx, commitments, `Could not verify team membership: ${teamError.message}`);
    }
    memberTeams = new Set((rows ?? []).map((r: any) => r.team_id));
  }

  const items: Plan['items'] = [];
  const skipped: BulkActionFailure[] = [];

  for (const c of commitments) {
    if (c.team_id && !memberTeams.has(c.team_id)) {
      skipped.push({
        commitmentId: c.id,
        reason: "Target user is not a member of this commitment's team",
        severity: 'error',
      });
    } else if (ctx.action === 'reassign' && c.assigned_to_user_id === targetUserId) {
      skipped.push({ commitmentId: c.id, reason: 'Already assigned to this user', severity: 'warning' });
    } else {
      items.push({ id: c.id, oldValue: c.assigned_to_user_id || 'unassigned', newValue: targetUserId });
    }
  }

  return applyPlan(ctx, {
    items,
    skipped,
    patch: {
      assigned_to_user_id: targetUserId,
      escalation_sent_at: null, // reset escalation on (re)assignment
      escalation_level: 0,
      escalation_cancelled_at: null,
      updated_at: ctx.timestamp,
    },
    changeType: 'updated',
    notes: `Bulk ${ctx.action} via bulk actions API`,
  });
}

async function handleStatus(ctx: Ctx, commitments: any[], newStatus: TaskStatus) {
  const validStatuses: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'overdue', 'done'];
  if (!validStatuses.includes(newStatus)) {
    return failAll(ctx, commitments, `Invalid status: ${newStatus}`);
  }

  const isDone = newStatus === 'completed' || newStatus === 'done';
  const items: Plan['items'] = [];
  const skipped: BulkActionFailure[] = [];

  for (const c of commitments) {
    const fromTerminal = c.status === 'completed' || c.status === 'done';
    if (fromTerminal && !isDone) {
      skipped.push({
        commitmentId: c.id,
        reason: 'Cannot transition from terminal status (completed/done)',
        severity: 'error',
      });
    } else if (c.status === newStatus) {
      skipped.push({ commitmentId: c.id, reason: `Already in status: ${newStatus}`, severity: 'warning' });
    } else {
      items.push({ id: c.id, oldValue: c.status, newValue: newStatus });
    }
  }

  const patch: Record<string, unknown> = { status: newStatus, updated_at: ctx.timestamp };
  if (isDone) {
    patch.completed_at = ctx.timestamp;
    patch.escalation_sent_at = null;
    patch.escalation_level = 0;
    patch.escalation_cancelled_at = ctx.timestamp;
  }

  return applyPlan(ctx, {
    items,
    skipped,
    patch,
    changeType: 'status_changed',
    notes: 'Bulk status update via bulk actions API',
  });
}

async function handleDueDate(ctx: Ctx, commitments: any[], newDueDate: string | null | undefined) {
  if (newDueDate === undefined) return failAll(ctx, commitments, 'Missing due date');
  if (newDueDate !== null && (typeof newDueDate !== 'string' || isNaN(new Date(newDueDate).getTime()))) {
    return failAll(ctx, commitments, `Invalid date format: ${newDueDate}`);
  }

  const items: Plan['items'] = [];
  const skipped: BulkActionFailure[] = [];

  for (const c of commitments) {
    if (c.due_date === newDueDate) {
      skipped.push({ commitmentId: c.id, reason: 'Already has this due date', severity: 'warning' });
    } else {
      items.push({ id: c.id, oldValue: c.due_date || 'none', newValue: newDueDate || 'none' });
    }
  }

  return applyPlan(ctx, {
    items,
    skipped,
    patch: { due_date: newDueDate, updated_at: ctx.timestamp },
    changeType: 'date_changed',
    notes: 'Bulk due-date update via bulk actions API',
  });
}

async function handlePriority(ctx: Ctx, commitments: any[], newPriority: TaskPriority) {
  const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  if (!validPriorities.includes(newPriority)) {
    return failAll(ctx, commitments, `Invalid priority: ${newPriority}`);
  }

  const items: Plan['items'] = [];
  const skipped: BulkActionFailure[] = [];

  for (const c of commitments) {
    if (c.priority === newPriority) {
      skipped.push({ commitmentId: c.id, reason: `Already priority: ${newPriority}`, severity: 'warning' });
    } else {
      items.push({ id: c.id, oldValue: c.priority || 'medium', newValue: newPriority });
    }
  }

  return applyPlan(ctx, {
    items,
    skipped,
    patch: { priority: newPriority, updated_at: ctx.timestamp },
    changeType: 'updated',
    notes: 'Bulk priority update via bulk actions API',
  });
}