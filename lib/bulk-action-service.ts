/**
 * Bulk Action Service
 *
 * Handles 5 types of bulk commitment operations:
 * 1. Assign (unassigned → user)
 * 2. Reassign (change assignee)
 * 3. Status Update
 * 4. Due-Date Update
 * 5. Priority Update
 *
 * All operations respect organization/team isolation and authorization.
 * Triggers downstream Phase 4, 5, 6 systems appropriately.
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

/**
 * Execute a bulk action on selected commitments
 */
export async function executeBulkAction(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  request: BulkActionRequest,
): Promise<BulkActionResult> {
  const timestamp = new Date().toISOString();
  const successIds: string[] = [];
  const failures: BulkActionFailure[] = [];

  // Fetch all commitments to verify access and current state
  const { data: commitments, error: fetchError } = await supabase
    .from('tasks')
    .select('id, organization_id, team_id, status, assigned_to_user_id, due_date, priority')
    .in('id', request.commitmentIds)
    .eq('organization_id', organizationId);

  if (fetchError) {
    throw new Error(`Failed to fetch commitments: ${fetchError.message}`);
  }

  // Verify all requested IDs exist in this organization
  if (!commitments || commitments.length !== request.commitmentIds.length) {
    const foundIds = new Set(commitments?.map((c: any) => c.id) ?? []);
    const missing = request.commitmentIds.filter(id => !foundIds.has(id));
    return {
      action: request.action,
      totalRequested: request.commitmentIds.length,
      successCount: 0,
      failedCount: request.commitmentIds.length,
      successIds: [],
      failures: missing.map(id => ({
        commitmentId: id,
        reason: 'Commitment not found or not accessible',
        severity: 'error',
      })),
      resultMetadata: { timestamp, changedByUserId: userId, organizationId },
    };
  }

  // Execute action based on type
  switch (request.action) {
    case 'assign':
    case 'reassign':
      return await handleAssignmentAction(
        supabase,
        userId,
        organizationId,
        commitments,
        request.action,
        'targetUserId' in request.value ? request.value.targetUserId : '',
        timestamp,
      );

    case 'status':
      return await handleStatusAction(
        supabase,
        userId,
        organizationId,
        commitments,
        'newStatus' in request.value ? request.value.newStatus : 'open',
        timestamp,
      );

    case 'due_date':
      return await handleDueDateAction(
        supabase,
        userId,
        organizationId,
        commitments,
        'newDueDate' in request.value ? request.value.newDueDate : null,
        timestamp,
      );

    case 'priority':
      return await handlePriorityAction(
        supabase,
        userId,
        organizationId,
        commitments,
        'newPriority' in request.value ? request.value.newPriority : 'medium',
        timestamp,
      );

    default:
      throw new Error(`Unknown action: ${request.action}`);
  }
}

/**
 * Handle assign/reassign actions
 */
async function handleAssignmentAction(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  commitments: any[],
  action: 'assign' | 'reassign',
  targetUserId: string,
  timestamp: string,
): Promise<BulkActionResult> {
  const successIds: string[] = [];
  const failures: BulkActionFailure[] = [];

  // Verify target user exists and is in same organization
  const { data: targetUser, error: userError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (userError || !targetUser) {
    return {
      action,
      totalRequested: commitments.length,
      successCount: 0,
      failedCount: commitments.length,
      successIds: [],
      failures: commitments.map(c => ({
        commitmentId: c.id,
        reason: 'Target user not found in organization',
        severity: 'error',
      })),
      resultMetadata: { timestamp, changedByUserId: userId, organizationId },
    };
  }

  // Validate and update each commitment
  for (const commitment of commitments) {
    try {
      // If commitment has team_id, verify target user is in that team
      if (commitment.team_id) {
        const { data: teamMember, error: teamError } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', commitment.team_id)
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (teamError || !teamMember) {
          failures.push({
            commitmentId: commitment.id,
            reason: 'Target user is not a member of this commitment\'s team',
            severity: 'error',
          });
          continue;
        }
      }

      // Skip if already assigned to this user (for reassign)
      if (action === 'reassign' && commitment.assigned_to_user_id === targetUserId) {
        failures.push({
          commitmentId: commitment.id,
          reason: 'Already assigned to this user',
          severity: 'warning',
        });
        continue;
      }

      // Update assignment
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          assigned_to_user_id: targetUserId,
          escalation_sent_at: null,     // Reset escalation on reassignment
          escalation_level: 0,
          escalation_cancelled_at: null,
          updated_at: timestamp,
        })
        .eq('id', commitment.id);

      if (updateError) {
        failures.push({
          commitmentId: commitment.id,
          reason: `Update failed: ${updateError.message}`,
          severity: 'error',
        });
        continue;
      }

      // Log history
      await supabase.from('commitment_history').insert({
        task_id: commitment.id,
        user_id: userId,
        change_type: 'updated',
        old_value: commitment.assigned_to_user_id || 'unassigned',
        new_value: targetUserId,
        notes: `Bulk ${action} via bulk actions API`,
      });

      successIds.push(commitment.id);
    } catch (err) {
      failures.push({
        commitmentId: commitment.id,
        reason: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  return {
    action,
    totalRequested: commitments.length,
    successCount: successIds.length,
    failedCount: failures.length,
    successIds,
    failures,
    resultMetadata: { timestamp, changedByUserId: userId, organizationId },
  };
}

/**
 * Handle status update action
 */
async function handleStatusAction(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  commitments: any[],
  newStatus: TaskStatus,
  timestamp: string,
): Promise<BulkActionResult> {
  const successIds: string[] = [];
  const failures: BulkActionFailure[] = [];

  // Validate status value
  const validStatuses: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'overdue', 'done'];
  if (!validStatuses.includes(newStatus)) {
    return {
      action: 'status',
      totalRequested: commitments.length,
      successCount: 0,
      failedCount: commitments.length,
      successIds: [],
      failures: commitments.map(c => ({
        commitmentId: c.id,
        reason: `Invalid status: ${newStatus}`,
        severity: 'error',
      })),
      resultMetadata: { timestamp, changedByUserId: userId, organizationId },
    };
  }

  // Update each commitment
  for (const commitment of commitments) {
    try {
      // Cannot transition from terminal states (completed, done)
      if (commitment.status === 'completed' || commitment.status === 'done') {
        if (newStatus !== 'completed' && newStatus !== 'done') {
          failures.push({
            commitmentId: commitment.id,
            reason: 'Cannot transition from terminal status (completed/done)',
            severity: 'error',
          });
          continue;
        }
      }

      // Skip if already in desired state
      if (commitment.status === newStatus) {
        failures.push({
          commitmentId: commitment.id,
          reason: `Already in status: ${newStatus}`,
          severity: 'warning',
        });
        continue;
      }

      // Prepare update object
      const updateObj: any = {
        status: newStatus,
        updated_at: timestamp,
      };

      // If marking as completed, set completed_at and clear escalation
      if (newStatus === 'completed' || newStatus === 'done') {
        updateObj.completed_at = timestamp;
        updateObj.escalation_sent_at = null;
        updateObj.escalation_level = 0;
        updateObj.escalation_cancelled_at = timestamp;
      }

      // Update commitment
      const { error: updateError } = await supabase
        .from('tasks')
        .update(updateObj)
        .eq('id', commitment.id);

      if (updateError) {
        failures.push({
          commitmentId: commitment.id,
          reason: `Update failed: ${updateError.message}`,
          severity: 'error',
        });
        continue;
      }

      // Log history
      await supabase.from('commitment_history').insert({
        task_id: commitment.id,
        user_id: userId,
        change_type: 'status_changed',
        old_value: commitment.status,
        new_value: newStatus,
        notes: 'Bulk status update via bulk actions API',
      });

      successIds.push(commitment.id);
    } catch (err) {
      failures.push({
        commitmentId: commitment.id,
        reason: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  return {
    action: 'status',
    totalRequested: commitments.length,
    successCount: successIds.length,
    failedCount: failures.length,
    successIds,
    failures,
    resultMetadata: { timestamp, changedByUserId: userId, organizationId },
  };
}

/**
 * Handle due-date update action
 */
async function handleDueDateAction(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  commitments: any[],
  newDueDate: string | null,
  timestamp: string,
): Promise<BulkActionResult> {
  const successIds: string[] = [];
  const failures: BulkActionFailure[] = [];

  // Validate date format if provided
  if (newDueDate && isNaN(new Date(newDueDate).getTime())) {
    return {
      action: 'due_date',
      totalRequested: commitments.length,
      successCount: 0,
      failedCount: commitments.length,
      successIds: [],
      failures: commitments.map(c => ({
        commitmentId: c.id,
        reason: `Invalid date format: ${newDueDate}`,
        severity: 'error',
      })),
      resultMetadata: { timestamp, changedByUserId: userId, organizationId },
    };
  }

  // Update each commitment
  for (const commitment of commitments) {
    try {
      // Skip if already has this due date
      if (commitment.due_date === newDueDate) {
        failures.push({
          commitmentId: commitment.id,
          reason: 'Already has this due date',
          severity: 'warning',
        });
        continue;
      }

      // Update commitment
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          due_date: newDueDate,
          updated_at: timestamp,
        })
        .eq('id', commitment.id);

      if (updateError) {
        failures.push({
          commitmentId: commitment.id,
          reason: `Update failed: ${updateError.message}`,
          severity: 'error',
        });
        continue;
      }

      // Log history
      await supabase.from('commitment_history').insert({
        task_id: commitment.id,
        user_id: userId,
        change_type: 'date_changed',
        old_value: commitment.due_date || 'none',
        new_value: newDueDate || 'none',
        notes: 'Bulk due-date update via bulk actions API',
      });

      successIds.push(commitment.id);
    } catch (err) {
      failures.push({
        commitmentId: commitment.id,
        reason: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  return {
    action: 'due_date',
    totalRequested: commitments.length,
    successCount: successIds.length,
    failedCount: failures.length,
    successIds,
    failures,
    resultMetadata: { timestamp, changedByUserId: userId, organizationId },
  };
}

/**
 * Handle priority update action
 */
async function handlePriorityAction(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  commitments: any[],
  newPriority: TaskPriority,
  timestamp: string,
): Promise<BulkActionResult> {
  const successIds: string[] = [];
  const failures: BulkActionFailure[] = [];

  // Validate priority value
  const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  if (!validPriorities.includes(newPriority)) {
    return {
      action: 'priority',
      totalRequested: commitments.length,
      successCount: 0,
      failedCount: commitments.length,
      successIds: [],
      failures: commitments.map(c => ({
        commitmentId: c.id,
        reason: `Invalid priority: ${newPriority}`,
        severity: 'error',
      })),
      resultMetadata: { timestamp, changedByUserId: userId, organizationId },
    };
  }

  // Update each commitment
  for (const commitment of commitments) {
    try {
      // Skip if already has this priority
      if (commitment.priority === newPriority) {
        failures.push({
          commitmentId: commitment.id,
          reason: `Already priority: ${newPriority}`,
          severity: 'warning',
        });
        continue;
      }

      // Update commitment
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          priority: newPriority,
          updated_at: timestamp,
        })
        .eq('id', commitment.id);

      if (updateError) {
        failures.push({
          commitmentId: commitment.id,
          reason: `Update failed: ${updateError.message}`,
          severity: 'error',
        });
        continue;
      }

      // Log history
      await supabase.from('commitment_history').insert({
        task_id: commitment.id,
        user_id: userId,
        change_type: 'updated',
        old_value: commitment.priority || 'medium',
        new_value: newPriority,
        notes: 'Bulk priority update via bulk actions API',
      });

      successIds.push(commitment.id);
    } catch (err) {
      failures.push({
        commitmentId: commitment.id,
        reason: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  return {
    action: 'priority',
    totalRequested: commitments.length,
    successCount: successIds.length,
    failedCount: failures.length,
    successIds,
    failures,
    resultMetadata: { timestamp, changedByUserId: userId, organizationId },
  };
}
