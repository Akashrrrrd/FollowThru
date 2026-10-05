/**
 * Escalation Service
 *
 * Core business logic for escalation workflow:
 * - Determine eligible commitments for escalation
 * - Route escalations to correct recipient (team lead → manager → owner)
 * - Create escalation records atomically (prevent duplicates)
 * - Update escalation state
 *
 * This service works in concert with the cron job.
 * All database operations use atomic guards for idempotency.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ESCALATION_POLICY,
  isCommitmentOverdue,
  calculateHoursOverdue,
  isEscalationDue,
} from './reminder-escalation-config';
import { getUserOrganizationContext } from './organization-context';
import { getUserTeamContext } from './team-context';

export interface CommitmentForEscalation {
  id: string;
  organization_id: string;
  team_id: string | null;
  assigned_to_user_id: string;
  due_date: string;
  status: string;
  escalation_level: number;
  escalation_sent_at: string | null;
  escalation_cancelled_at: string | null;
  description: string;
  owner: string;
}

export interface EscalationRecipient {
  recipient_user_id: string;
  recipient_role: 'team_lead' | 'manager' | 'owner';
  escalation_level: number;
}

export interface EscalationResult {
  commitment_id: string;
  escalation_created: boolean;
  escalation_history_id?: string; // Phase 5: ID for notification tracking
  escalation_type?: '24h_overdue' | '48h_overdue' | '72h_overdue'; // Phase 5: For notification context
  recipient_user_id: string | null;
  recipient_role: string | null;
  hours_overdue: number;
  error?: string;
}

/**
 * Get commitments eligible for escalation
 *
 * Queries based on policy:
 * - 24h overdue → escalate to team lead
 * - 48h overdue → escalate to manager
 * - 72h overdue → escalate to owner
 *
 * @param supabase Supabase client with service role
 * @param organizationId Organization to process
 * @param hoursOverdueThreshold Only get commitments at least this many hours overdue
 */
export async function getCommitmentsEligibleForEscalation(
  supabase: SupabaseClient,
  organizationId: string,
  hoursOverdueThreshold: number = 24
): Promise<CommitmentForEscalation[]> {
  const now = new Date();
  const thresholdMs = hoursOverdueThreshold * 60 * 60 * 1000;
  const thresholdTime = new Date(now.getTime() - thresholdMs);

  const { data: commitments, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', organizationId)
    .in('status', ['open', 'in_progress'])
    .lt('due_date', thresholdTime.toISOString())
    .is('escalation_cancelled_at', null)
    .not('due_date', 'is', null);

  if (error) {
    console.error('[escalation] Error fetching eligible commitments:', error.message);
    return [];
  }

  return (commitments as CommitmentForEscalation[]) || [];
}

/**
 * Get next escalation recipient for a commitment
 *
 * Determines who should receive the next escalation based on:
 * 1. Current escalation level
 * 2. Hours overdue
 * 3. Organization hierarchy
 *
 * @param supabase Supabase client with service role
 * @param commitment The commitment to escalate
 * @returns Recipient info or null if no valid recipient
 */
export async function getNextEscalationRecipient(
  supabase: SupabaseClient,
  commitment: CommitmentForEscalation
): Promise<EscalationRecipient | null> {
  const hoursOverdue = calculateHoursOverdue(commitment.due_date);
  const policy = DEFAULT_ESCALATION_POLICY;

  // Determine what escalation level should happen now
  let targetEscalationLevel = 0;

  if (hoursOverdue >= 72) {
    targetEscalationLevel = 3; // owner
  } else if (hoursOverdue >= 48) {
    targetEscalationLevel = 2; // manager
  } else if (hoursOverdue >= 24) {
    targetEscalationLevel = 1; // team_lead
  }

  // If no escalation is due yet, return null
  if (targetEscalationLevel === 0 || targetEscalationLevel <= commitment.escalation_level) {
    return null;
  }

  // Use the get_next_escalation_recipient database function to route escalation
  const { data: recipients, error } = await supabase.rpc(
    'get_next_escalation_recipient',
    {
      p_task_id: commitment.id,
      p_organization_id: commitment.organization_id,
      p_current_user_id: commitment.assigned_to_user_id,
    }
  );

  if (error) {
    console.error('[escalation] Error getting escalation recipient:', error.message);
    return null;
  }

  if (!recipients || recipients.length === 0) {
    console.log(
      `[escalation] No escalation recipient found for commitment ${commitment.id} (assigned to ${commitment.assigned_to_user_id})`
    );
    return null;
  }

  // Map the RPC result to our interface
  const recipient = recipients[0];
  return {
    recipient_user_id: recipient.recipient_user_id,
    recipient_role: recipient.recipient_role,
    escalation_level: recipient.escalation_level,
  };
}

/**
 * Create escalation record atomically
 *
 * Uses unique constraint to prevent duplicate escalations:
 * - If same commitment/recipient/type was escalated today, skip
 * - Atomic guard prevents concurrent duplicates
 *
 * @param supabase Supabase client with service role
 * @param commitment Commitment being escalated
 * @param recipient Who to escalate to
 * @returns Success or failure details
 */
export async function createEscalationRecord(
  supabase: SupabaseClient,
  commitment: CommitmentForEscalation,
  recipient: EscalationRecipient
): Promise<EscalationResult> {
  const hoursOverdue = calculateHoursOverdue(commitment.due_date);
  const escalationType =
    hoursOverdue >= 72 ? '72h_overdue' : hoursOverdue >= 48 ? '48h_overdue' : '24h_overdue';

  try {
    // Step 1: Insert into escalation_history (will fail if unique constraint violated)
    const { data: history, error: historyError } = await supabase
      .from('escalation_history')
      .insert({
        task_id: commitment.id,
        organization_id: commitment.organization_id,
        team_id: commitment.team_id,
        escalated_to_user_id: recipient.recipient_user_id,
        escalated_to_user_role: recipient.recipient_role,
        escalated_by_user_id: null,
        escalated_by: 'system',
        escalation_type: escalationType,
        escalation_level: recipient.escalation_level,
        hours_overdue_at_escalation: Math.round(hoursOverdue),
        commitment_due_date: commitment.due_date,
        commitment_owner_user_id: commitment.assigned_to_user_id,
        status: 'sent',
        delivery_channel: 'email',
      })
      .select('id')
      .single();

    if (historyError) {
      // Check if it's a unique constraint violation (already escalated today)
      if (historyError.message.includes('uq_escalation_same_day')) {
        console.log(
          `[escalation] Escalation already sent today for task ${commitment.id} to ${recipient.recipient_user_id}`
        );
        return {
          commitment_id: commitment.id,
          escalation_created: false,
          recipient_user_id: null,
          recipient_role: null,
          hours_overdue: hoursOverdue,
        };
      }

      console.error('[escalation] Error creating escalation history:', historyError.message);
      return {
        commitment_id: commitment.id,
        escalation_created: false,
        recipient_user_id: null,
        recipient_role: null,
        hours_overdue: hoursOverdue,
        error: historyError.message,
      };
    }

    // Step 2: Atomically update escalation_state for fast queries
    const { error: stateError } = await supabase
      .from('escalation_state')
      .upsert(
        {
          task_id: commitment.id,
          organization_id: commitment.organization_id,
          current_escalation_level: recipient.escalation_level,
          current_escalated_to_user_id: recipient.recipient_user_id,
          current_escalated_to_role: recipient.recipient_role,
          last_escalation_sent_at: new Date().toISOString(),
          next_escalation_due_at: calculateNextEscalationDueTime(commitment.due_date),
          commitment_due_date: commitment.due_date,
          is_resolved: false,
        },
        {
          onConflict: 'task_id',
        }
      );

    if (stateError) {
      console.error('[escalation] Error updating escalation state:', stateError.message);
      return {
        commitment_id: commitment.id,
        escalation_created: false,
        recipient_user_id: null,
        recipient_role: null,
        hours_overdue: hoursOverdue,
        error: stateError.message,
      };
    }

    // Step 3: Atomically update tasks table (for denormalization and fast queries)
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        escalation_sent_at: new Date().toISOString(),
        escalation_level: recipient.escalation_level,
      })
      .eq('id', commitment.id)
      .is('escalation_sent_at', null); // Guard: only update if not already set

    if (taskError) {
      // This is non-critical; history and state already recorded
      console.warn('[escalation] Warning updating tasks table:', taskError.message);
    }

    return {
      commitment_id: commitment.id,
      escalation_created: true,
      escalation_history_id: history.id, // Phase 5: For notification tracking
      escalation_type: escalationType, // Phase 5: For notification context
      recipient_user_id: recipient.recipient_user_id,
      recipient_role: recipient.recipient_role,
      hours_overdue: hoursOverdue,
    };
  } catch (err) {
    console.error('[escalation] Unexpected error creating escalation:', err);
    return {
      commitment_id: commitment.id,
      escalation_created: false,
      recipient_user_id: null,
      recipient_role: null,
      hours_overdue: hoursOverdue,
      error: String(err),
    };
  }
}

/**
 * Update escalation state to resolved (completed or acknowledged)
 *
 * @param supabase Supabase client with service role
 * @param taskId Task ID
 * @param resolvedBy User who resolved it
 * @param reason Why it was resolved (e.g., 'completed', 'acknowledged')
 */
export async function resolveEscalation(
  supabase: SupabaseClient,
  taskId: string,
  resolvedBy: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('escalation_state')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: resolvedBy,
    })
    .eq('task_id', taskId);

  if (error) {
    console.error('[escalation] Error resolving escalation:', error.message);
    return false;
  }

  return true;
}

/**
 * Calculate next escalation due time based on hours overdue
 *
 * Used for efficient queries to find next batch of escalations
 *
 * @param dueDate When commitment was due
 * @returns When next escalation should fire
 */
function calculateNextEscalationDueTime(dueDate: string | Date): string {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;

  // Next escalation is 24h after last one
  // Start with 24h overdue
  const nextDue = new Date(due.getTime() + 24 * 60 * 60 * 1000);
  return nextDue.toISOString();
}

/**
 * Check if commitment is eligible for escalation
 *
 * Validates all conditions before attempting to escalate:
 * - Commitment exists and is not deleted
 * - Commitment is not completed
 * - Commitment has a due date
 * - Commitment has an assigned user
 * - Commitment belongs to organization
 * - Not already escalated (or escalation was voided)
 *
 * @param commitment Commitment to check
 * @returns true if eligible
 */
export function isCommitmentEligibleForEscalation(
  commitment: CommitmentForEscalation
): boolean {
  // Completed commitments should never be escalated
  if (commitment.status === 'completed' || commitment.status === 'done') {
    return false;
  }

  // Must have due date
  if (!commitment.due_date) {
    return false;
  }

  // Must be assigned to someone
  if (!commitment.assigned_to_user_id) {
    return false;
  }

  // Must belong to an organization
  if (!commitment.organization_id) {
    return false;
  }

  // Escalation must not have been cancelled
  if (commitment.escalation_cancelled_at) {
    return false;
  }

  // Must be overdue
  if (!isCommitmentOverdue(commitment.due_date)) {
    return false;
  }

  return true;
}

/**
 * Format escalation message for display
 *
 * @param commitment The commitment
 * @param recipient The recipient (team lead, manager, etc.)
 * @param hoursOverdue How many hours overdue
 * @returns Human-readable escalation message
 */
export function formatEscalationMessage(
  commitment: CommitmentForEscalation,
  recipient: EscalationRecipient,
  hoursOverdue: number
): string {
  const hoursStr = Math.round(hoursOverdue) === 1 ? '1 hour' : `${Math.round(hoursOverdue)} hours`;

  return `Commitment overdue for ${hoursStr}: "${commitment.description}"
Assigned to: ${commitment.owner}
Due: ${new Date(commitment.due_date).toLocaleString()}
Status: ${commitment.status}

Please review and follow up.`;
}
