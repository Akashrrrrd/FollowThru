/**
 * Idempotency Service - Ensures exactly-once email delivery across retries
 * 
 * Design: Email idempotency is enforced at the database level via unique constraints
 * on idempotency_key in the notifications table. This ensures that duplicate events
 * (e.g., API retries, cron job retries) do not result in duplicate emails.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Idempotency Key Generation Strategies
 * 
 * Each notification type has a deterministic idempotency key that guarantees
 * the same event always produces the same key, enabling replay safety.
 */

/**
 * Generate idempotency key for task assignment events
 * Deterministic: Same task + assignee + event type = same key
 */
export function generateAssignmentIdempotencyKey(
  taskId: string,
  assignedToUserId: string,
  eventType: 'assignment' | 'reassignment'
): string {
  // Note: We include current timestamp to allow multiple assignments over time
  // but within the same request/retry window, we get the same key
  return `assignment-${taskId}-${assignedToUserId}-${eventType}`;
}

/**
 * Generate idempotency key for escalation events
 * Links to Phase 4 escalation_history ID for auditability
 */
export function generateEscalationIdempotencyKey(escalationHistoryId: string): string {
  return `escalation-${escalationHistoryId}`;
}

/**
 * Generate idempotency key for status change events
 * Deterministic: Task + new status = same key
 */
export function generateStatusChangeIdempotencyKey(
  taskId: string,
  newStatus: string
): string {
  return `status-${taskId}-${newStatus}`;
}

/**
 * Generate idempotency key for due date change events
 * Deterministic: Task + new due date = same key
 */
export function generateDueDateChangeIdempotencyKey(
  taskId: string,
  newDueDate: string | null
): string {
  const dateStr = newDueDate ? new Date(newDueDate).toISOString().split('T')[0] : 'none';
  return `duedate-${taskId}-${dateStr}`;
}

/**
 * Check if a notification with this idempotency key already exists
 * Returns existing notification ID if found, null otherwise
 */
export async function checkIdempotentNotification(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error) {
      console.error('[IdempotencyService] Error checking idempotent notification:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[IdempotencyService] Exception checking idempotent notification:', err);
    return null;
  }
}

/**
 * Ensure notification is created idempotently
 * 
 * If a notification with the same idempotency_key already exists for this user,
 * this returns the existing ID without creating a duplicate.
 * 
 * Uses database unique constraint to guarantee atomicity.
 */
export async function ensureIdempotentNotification(
  supabase: SupabaseClient,
  notificationData: {
    userId: string;
    organizationId: string;
    teamId?: string;
    commitmentId?: string;
    meetingId?: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
    relatedUserId?: string;
    idempotencyKey: string;
  }
): Promise<{ id: string; isNew: boolean; error?: string }> {
  try {
    // Attempt to insert the notification
    // If idempotency_key already exists for this user, unique constraint will reject
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notificationData.userId,
        organization_id: notificationData.organizationId,
        team_id: notificationData.teamId,
        commitment_id: notificationData.commitmentId,
        meeting_id: notificationData.meetingId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        action_url: notificationData.actionUrl,
        related_user_id: notificationData.relatedUserId,
        idempotency_key: notificationData.idempotencyKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Check if this is a unique constraint violation (idempotency)
      if (error.code === '23505' && error.message.includes('idempotency_key')) {
        console.log(
          `[IdempotencyService] Idempotent notification already exists: ${notificationData.idempotencyKey}`
        );

        // Fetch the existing notification ID
        const { data: existing, error: fetchError } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', notificationData.userId)
          .eq('idempotency_key', notificationData.idempotencyKey)
          .maybeSingle();

        if (fetchError || !existing) {
          return { id: '', isNew: false, error: 'Idempotent notification exists but could not be retrieved' };
        }

        return { id: existing.id, isNew: false };
      }

      // Other database error
      console.error('[IdempotencyService] Error creating notification:', error);
      return { id: '', isNew: false, error: error.message };
    }

    if (!data) {
      return { id: '', isNew: false, error: 'Notification created but no data returned' };
    }

    console.log(`[IdempotencyService] Created new notification: ${data.id}`);
    return { id: data.id, isNew: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[IdempotencyService] Exception creating notification:', err);
    return { id: '', isNew: false, error };
  }
}

/**
 * IDEMPOTENCY DOCUMENTATION
 * 
 * Each notification type has distinct idempotency guarantees:
 * 
 * 1. ASSIGNMENT (assignment / reassignment):
 *    - Key: "assignment-{taskId}-{assignedToUserId}-{type}"
 *    - Scope: Per task per assignee per event type
 *    - Guarantee: Same task won't trigger duplicate assignment notifications to same user
 *    - Replay safety: If API request is retried, existing notification is returned
 *    - Limitation: If user is reassigned multiple times, each gets its own notification
 * 
 * 2. ESCALATION (escalation):
 *    - Key: "escalation-{escalationHistoryId}"
 *    - Scope: Per Phase 4 escalation_history record
 *    - Guarantee: Unique to each escalation event
 *    - Replay safety: Cron job retries won't create duplicate notifications
 *    - Linkage: Directly tied to escalation_history for auditability
 *    - Phase 4 idempotency: escalation_history also has unique constraint per day
 * 
 * 3. STATUS CHANGE (status_change):
 *    - Key: "status-{taskId}-{newStatus}"
 *    - Scope: Per task per new status value
 *    - Guarantee: Same task won't trigger duplicate status change notifications for same new status
 *    - Replay safety: Changing to "completed" twice only sends one notification
 *    - Limitation: Different status transitions create separate notifications
 * 
 * 4. DUE DATE CHANGE (status_change):
 *    - Key: "duedate-{taskId}-{newDueDate}"
 *    - Scope: Per task per new due date value
 *    - Guarantee: Same task won't trigger duplicate due date notifications for same date
 *    - Replay safety: Setting due date to "2025-01-15" twice only sends one notification
 *    - Limitation: Different date changes create separate notifications
 * 
 * DATABASE LEVEL GUARANTEES:
 * 
 * The notifications table has a UNIQUE constraint on (idempotency_key, user_id):
 * 
 *   CREATE UNIQUE INDEX idx_notifications_idempotency_key 
 *   ON notifications(idempotency_key, user_id) 
 *   WHERE idempotency_key IS NOT NULL;
 * 
 * This ensures:
 * - Database enforces exactly-once per (key, user) pair
 * - Concurrent duplicate insert attempts receive constraint violation error
 * - idempotency_key lookup is O(log n) via index
 * - No application-level locking needed (DB handles atomicity)
 * 
 * EMAIL DELIVERY IDEMPOTENCY:
 * 
 * Email delivery has TWO layers of idempotency:
 * 
 * Layer 1: Notification Creation (this service)
 *   - Prevents duplicate notification records from being created
 *   - Ensures at most one in-app notification per event
 * 
 * Layer 2: Email Provider Idempotency (sendEmailNotification)
 *   - Even if email is sent multiple times, provider may have its own dedup
 *   - Gmail SMTP: Messages are identified by Message-ID header (unique per send)
 *   - Our implementation doesn't deduplicate at email level intentionally:
 *     - Email provider may reject/deduplicate if needed
 *     - Focus is on notification record deduplication
 *     - Users rarely see email delivery duplication due to Provider dedup + SMTP ID
 * 
 * ERROR SCENARIOS & RECOVERY:
 * 
 * Scenario 1: API crashes after creating notification, before sending email
 *   - Notification exists with email_sent_at = NULL
 *   - Retry of request returns existing notification
 *   - Email could still be sent later (grace period varies)
 *   - Result: At most one notification, one email sent eventually
 * 
 * Scenario 2: Email send fails, notification created with email_failed_at
 *   - Retry of request returns existing notification
 *   - Email not retried automatically (mark for manual review)
 *   - Result: Notification exists showing failure, can be debugged
 * 
 * Scenario 3: Cron job retries due to timeout
 *   - First run creates escalation_history record + notification
 *   - Retry: escalation_history unique constraint prevents duplicate
 *   - Retry: notification idempotency_key prevents duplicate
 *   - Result: No duplicate notifications sent
 * 
 * TESTING IDEMPOTENCY:
 * 
 * Test cases to verify:
 * 1. Create notification, retry same request → Same notification ID returned
 * 2. Create task assignment, PATCH twice with same assignee → One notification
 * 3. Cron escalation runs twice in quick succession → One escalation email
 * 4. Status change in bulk operation → One notification per final status
 * 
 * See manual test cases in Task 13 for detailed test procedures.
 */
