# Phase 5 Email Idempotency Architecture

## Overview

Phase 5 implements production-grade email idempotency to ensure exactly-once email delivery across retries, network failures, and concurrent requests. This document describes the architecture, implementation, and testing strategies.

## Design Principles

1. **Database-First**: Idempotency is enforced at the database layer, not in application code
2. **Deterministic Keys**: Idempotency keys are generated deterministically from event data
3. **Atomic Guarantees**: Database unique constraints prevent race conditions without application locking
4. **Graceful Degradation**: If idempotency fails, notifications still succeed (partial delivery is acceptable)
5. **Observable**: Idempotency key stored in every notification for debugging and auditing

## Notification Table Schema (Idempotency Fields)

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  
  -- Idempotency guarantee
  idempotency_key TEXT UNIQUE, -- Globally unique within notifications table
  
  -- Email tracking
  email_sent_at TIMESTAMPTZ,         -- When email was successfully sent
  email_failed_at TIMESTAMPTZ,       -- When email send failed
  email_error TEXT,                  -- Error message if send failed
  
  -- Existing fields
  type TEXT NOT NULL,                -- 'assignment', 'escalation', 'status_change', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint ensures idempotency
CREATE UNIQUE INDEX idx_notifications_idempotency_key 
  ON notifications(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
```

## Idempotency Key Strategies by Event Type

### 1. Task Assignment (New Assignment)

**Event**: User is assigned to a task for the first time

**Key Format**: `assignment-{taskId}-{assignedToUserId}-assignment`

**Example**: `assignment-abc-123-def-456-assignment`

**Scope**: Per task, per assignee

**Guarantees**:
- Same task won't send duplicate "assignment" email to same user
- Different assignees each get their own notification
- Reassignment uses different key (see below)

**Replay Safety**: ✅ API retry → Same notification returned, email not resent

**Example Scenario**:
```
Request 1: PATCH /tasks/abc-123 { assigned_to_user_id: def-456 }
  → Creates notification with key "assignment-abc-123-def-456-assignment"
  → Sends email to def-456
  
Request 2 (retry): PATCH /tasks/abc-123 { assigned_to_user_id: def-456 }
  → Idempotency_key already exists
  → Returns existing notification ID
  → Email NOT resent
```

### 2. Task Reassignment

**Event**: Task reassigned from one user to another

**Key Format**: `assignment-{taskId}-{newAssignedToUserId}-reassignment`

**Example**: `assignment-abc-123-ghi-789-reassignment`

**Scope**: Per task, per new assignee

**Guarantees**:
- Same task won't send duplicate "reassignment" email to same user
- Different reassignees each get their own notification
- Reassigning back to previous user creates new notification

**Replay Safety**: ✅ Cron retry → Same notification returned, email not resent

### 3. Escalation

**Event**: Phase 4 escalation created (task goes to team lead/manager/owner)

**Key Format**: `escalation-{escalationHistoryId}`

**Example**: `escalation-esc-001-uuid`

**Scope**: Unique per Phase 4 escalation record

**Guarantees**:
- Each escalation event has exactly one notification
- Linked directly to Phase 4 escalation_history for auditability
- Multiple escalations of same task create separate notifications

**Phase 4 Integration**:
- Phase 4 escalation_history has unique constraint: (task_id, escalated_to_user_id, escalation_type, DATE)
- Prevents duplicate escalations within same calendar day
- Phase 5 idempotency_key links to escalation_history.id for traceability

**Replay Safety**: ✅ Cron retry → Same notification returned, email not resent

**Example Scenario**:
```
Task "API Docs" is 24h overdue, escalated to Team Lead Alice
  → escalation_history.id = "esc-uuid-001"
  → notification.idempotency_key = "escalation-esc-uuid-001"
  → Email sent to alice@company.com
  
Cron retries same escalation
  → Phase 4: unique constraint prevents new escalation_history
  → Phase 5: idempotency_key prevents new notification
  → Result: One escalation email total
```

### 4. Status Change

**Event**: Task status changed (open → completed, blocked, in_progress, etc.)

**Key Format**: `status-{taskId}-{newStatus}`

**Example**: `status-abc-123-completed`

**Scope**: Per task, per status value

**Guarantees**:
- Same task won't send duplicate "status change" email for same final status
- Different status transitions create separate notifications
- Only latest status change per task is recorded for idempotency

**Example Scenarios**:
```
Scenario 1: Status changed open → completed
  Key: "status-abc-123-completed"
  Retry: Returns existing notification
  
Scenario 2: Status changed completed → open (reopen)
  Key: "status-abc-123-open"
  New notification (different key)
  
Scenario 3: Bulk status update (same task changed 3 times in 1 second)
  open → in_progress → blocked → completed
  Only notification for "completed" survives (last one wins)
  (Note: Earlier status changes create intermediate notifications that exist)
```

### 5. Due Date Change

**Event**: Task due date modified

**Key Format**: `duedate-{taskId}-{newDueDate}`

**Example**: `duedate-abc-123-2025-01-15` or `duedate-abc-123-none` (if cleared)

**Scope**: Per task, per due date value

**Guarantees**:
- Same task won't send duplicate email for same new due date
- Different dates create separate notifications
- Clearing due date (null) has separate key from any specific date

**Example Scenarios**:
```
Scenario 1: Due date set to 2025-01-15
  Key: "duedate-abc-123-2025-01-15"
  Retry: Returns existing notification
  
Scenario 2: Due date cleared (set to null)
  Key: "duedate-abc-123-none"
  Separate notification (different key)
  
Scenario 3: Due date changed 2025-01-15 → 2025-01-10 (earlier)
  First notification: "duedate-abc-123-2025-01-15"
  Second notification: "duedate-abc-123-2025-01-10"
  Both emails sent (different dates)
```

## Implementation Details

### Step 1: Key Generation

Each event handler generates a deterministic idempotency key:

```typescript
// In notification handlers:
const idempotencyKey = generateAssignmentIdempotencyKey(taskId, assignedToUserId, 'assignment');
const idempotencyKey = generateEscalationIdempotencyKey(escalationHistoryId);
const idempotencyKey = generateStatusChangeIdempotencyKey(taskId, newStatus);
const idempotencyKey = generateDueDateChangeIdempotencyKey(taskId, newDueDate);
```

### Step 2: Check Existing Notification

Before creating, check if notification already exists:

```typescript
const existingId = await checkIdempotentNotification(supabase, userId, idempotencyKey);
if (existingId) {
  console.log('Idempotent notification already exists:', existingId);
  return { id: existingId, created: false };
}
```

### Step 3: Create In-App Notification

Insert into notifications table with idempotency_key:

```typescript
const { data, error } = await supabase
  .from('notifications')
  .insert({
    user_id: userId,
    type: notificationType,
    title: 'Notification title',
    message: 'Notification message',
    idempotency_key: idempotencyKey,
    // ... other fields
  })
  .select('id')
  .single();

// If unique constraint violation (PGRST code 23505):
// → Idempotent notification already exists
// → Fetch and return existing ID
```

### Step 4: Send Email (Non-Blocking)

Email send is non-blocking. If notification created, email is sent asynchronously:

```typescript
// After notification created:
if (result.id) {
  sendEmailNotification(supabase, result.id, emailData)
    .catch(err => console.error('Email failed:', err));
  // Don't await - return immediately
}
```

### Step 5: Track Email Status

Email outcome recorded in notification:

```typescript
// If email sends successfully:
UPDATE notifications SET email_sent_at = NOW()

// If email fails:
UPDATE notifications SET 
  email_failed_at = NOW(),
  email_error = 'Failed to send: ...'
```

## Error Scenarios & Recovery

### Scenario 1: API Crash After Notification Created, Before Email Sent

**Timeline**:
1. Notification created (✓ idempotency_key inserted)
2. Email send begins
3. API crashes
4. Retry request

**Recovery**:
- Retry: Idempotency_key lookup finds existing notification
- Existing notification returned with id
- Email may or may not have been sent (depends on crash timing)
- Result: At most one notification, at most one email ✓

### Scenario 2: Email Provider Temporarily Unavailable

**Timeline**:
1. Notification created (✓)
2. Email send → Provider returns 5xx error
3. Email failure recorded (email_failed_at set)

**Recovery**:
- Admin can retry via dashboard (future feature)
- Notification still visible to user as "failed"
- Indicates troubleshooting needed
- Result: Notification exists, user aware of issue ✓

### Scenario 3: Concurrent Duplicate Requests (Race Condition)

**Timeline**:
1. Request A: Create assignment to user X
2. Request B: Create same assignment to user X (race)
3. Both reach database simultaneously

**Recovery**:
- Database unique constraint on (idempotency_key, user_id)
- One request succeeds, one gets 23505 constraint violation
- Constraint violation caught in code → Fetch existing notification
- Both return same notification ID
- Result: One notification, one email ✓

### Scenario 4: Cron Job Timeout & Retry

**Timeline**:
1. Escalation cron creates escalation_history + notification
2. Cron times out before returning
3. System retries cron job

**Recovery**:
- Phase 4 escalation_history unique constraint prevents duplicate
- Phase 5 notification idempotency_key prevents duplicate
- Retry: All idempotency checks pass
- Result: No duplicate notifications ✓

## Testing Idempotency

See Task 13 (Manual Testing) for comprehensive test procedures. Key tests:

1. **Request Retry**: Send same request twice, verify same notification returned
2. **Concurrent Requests**: Send duplicate requests simultaneously, verify one email
3. **Cron Retry**: Run cron twice in succession, verify no duplicate escalations
4. **Status Updates**: PATCH status multiple times, verify notifications respect key
5. **Date Changes**: Update due date multiple times, verify separate notifications per date

## Monitoring & Debugging

### Idempotency Key Lookup

To debug idempotency, find notification by key:

```sql
SELECT id, user_id, email_sent_at, email_failed_at, email_error
FROM notifications
WHERE idempotency_key = 'assignment-abc-123-def-456-assignment'
```

### Email Failure Analysis

Find notifications where email failed:

```sql
SELECT id, title, email_failed_at, email_error
FROM notifications
WHERE email_failed_at IS NOT NULL
ORDER BY email_failed_at DESC
LIMIT 20
```

### Audit Trail

Link escalation to notification:

```sql
SELECT 
  eh.id as escalation_id,
  eh.escalated_to_user_id,
  n.id as notification_id,
  n.email_sent_at,
  n.email_failed_at
FROM escalation_history eh
LEFT JOIN notifications n ON n.idempotency_key = CONCAT('escalation-', eh.id)
WHERE eh.organization_id = 'org-uuid'
ORDER BY eh.created_at DESC
```

## Future Enhancements (Phase 6+)

1. **Email Retry Logic**: Automatic retry of failed emails after grace period
2. **Bulk Email Deduplication**: Aggregate notifications into digest emails
3. **Rate Limiting**: Prevent email flood if same user triggers many notifications
4. **Delivery Confirmation**: Track email opens via pixel/link tracking (privacy-sensitive)
5. **Slack/Teams Idempotency**: Extend idempotency to non-email channels

## References

- **Idempotency Service**: `lib/idempotency-service.ts`
- **Notification Service**: `lib/notification-service.ts`
- **Database Schema**: `supabase/migrations/20261005000002_phase5_unified_notifications.sql`
- **Manual Tests**: Task 13 in this spec
