# Phase 4: Reminder & Escalation Engine - Manual Test Plan

## Overview
Phase 4 implements a production-grade reminder and escalation engine for FollowThru commitments. This document outlines manual tests to verify:
- Reminder lifecycle (24h before, 1h before, overdue)
- Escalation routing (employee → team lead → manager → owner)
- Idempotency (no duplicate reminders/escalations)
- Concurrency safety (concurrent cron runs don't duplicate)
- RLS/security (org/team isolation preserved)
- Status changes (completion stops escalations)
- Due date changes (escalation schedule recalculates)

## Test Environment Setup

### Prerequisites
1. Development database with migrations applied
2. Gmail SMTP configured (GMAIL_USER, GMAIL_APP_PASSWORD in .env.local)
3. Vercel CRON_SECRET configured in .env.local
4. TestUser account with organization and team setup
5. Team Lead, Manager, and Owner accounts in same organization

### Test Data Template

```sql
-- Create test organization and users (use Supabase console or API)
INSERT INTO organizations (name, created_by) VALUES ('Test Org', '<user_id>');
INSERT INTO organization_members (organization_id, user_id, role) VALUES 
  ('<org_id>', '<employee_id>', 'member'),
  ('<org_id>', '<team_lead_id>', 'member'),
  ('<org_id>', '<manager_id>', 'manager'),
  ('<org_id>', '<owner_id>', 'owner');

-- Create team with team lead
INSERT INTO teams (organization_id, name, created_by) VALUES 
  ('<org_id>', 'Test Team', '<owner_id>');
INSERT INTO team_members (team_id, user_id, role) VALUES 
  ('<team_id>', '<employee_id>', 'member'),
  ('<team_id>', '<team_lead_id>', 'team_lead');

-- Create test commitment (due 1 hour from now for testing)
INSERT INTO tasks (
  organization_id, team_id, user_id, assigned_to_user_id,
  description, due_date, status, owner
) VALUES (
  '<org_id>', '<team_id>', '<employee_id>', '<employee_id>',
  'TEST: Write API documentation',
  NOW() + INTERVAL '1 hour',
  'open',
  'Test Employee'
);
```

---

## TEST 1: 24-Hour Reminder

### Objective
Verify reminder is sent when commitment reaches 24-hour mark before due date.

### Steps
1. Create commitment due **tomorrow at 2 PM UTC** (24h from ~2 PM today)
2. Set `reminder_sent_at = NULL` to ensure it hasn't been reminded yet
3. **Manually trigger cron job**: `curl -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3000/api/cron/reminders`
4. Check logs for: `[cron] Starting reminder processing...` and `incoming: 1`
5. Verify in database: commitment `reminder_sent_at` is now set to current timestamp
6. Check email inbox: Should receive "Commitment Due Soon" email with 1 day notice

### Expected Results
- ✅ Reminder email received with subject "Commitment Due Soon: Write API documentation"
- ✅ `reminder_sent_at` timestamp recorded in tasks table
- ✅ Console logs show `incoming: 1`
- ✅ One reminder created (idempotent)

### Troubleshooting
- Email not received? Check GMAIL_USER/GMAIL_APP_PASSWORD configuration
- Cron returns 401? Verify CRON_SECRET matches

---

## TEST 2: 1-Hour Reminder

### Objective
Verify second reminder is sent when commitment reaches 1-hour mark before due date.

### Steps
1. Create commitment due **in 1 hour from now** (roughly 1 hour from current time)
2. Set `reminder_sent_at = NULL` (ensure first reminder hasn't been sent)
3. Run cron job manually
4. Check logs and database for reminder creation
5. Verify email received with time-sensitive message

### Expected Results
- ✅ Reminder email with subject containing "Due Soon" or similar time-critical language
- ✅ `reminder_sent_at` recorded
- ✅ Email indicates ~1 hour remaining

---

## TEST 3: Overdue Reminder

### Objective
Verify reminder is sent when commitment becomes overdue.

### Steps
1. Create commitment due **1 hour ago** (in the past)
2. Set status to 'open' (not completed)
3. Run cron job manually
4. Check logs for: `overdue: 1`
5. Verify in database: `overdue_reminder_sent_at` is now set
6. Check email: Should receive "OVERDUE" email

### Expected Results
- ✅ Overdue email received with subject "OVERDUE: ..."
- ✅ `overdue_reminder_sent_at` timestamp recorded
- ✅ Console logs show `overdue: 1`
- ✅ Email states hours/days overdue

---

## TEST 4: Escalation - 24h Overdue

### Objective
Verify escalation fires when commitment is 24+ hours overdue.

### Steps
1. Create commitment due **25 hours ago**
2. Assign to Employee (who is team member)
3. Ensure Team with Team Lead exists
4. Run cron job manually
5. Check `escalation_history` table for new record
6. Check `escalation_state` table for updated escalation_level = 1 (team_lead)
7. Verify Team Lead receives escalation email

### Expected Results
- ✅ `escalation_history` has 1 new row with `escalation_type = '24h_overdue'`, `escalated_to_user_role = 'team_lead'`
- ✅ `escalation_state` shows `current_escalation_level = 1`
- ✅ Team Lead receives email with subject "🚨 ESCALATION: Overdue Commitment"
- ✅ Email shows "Assigned To: Test Employee" and "Overdue 1d"

---

## TEST 5: Escalation - 48h Overdue (Manager)

### Objective
Verify second escalation to manager after 48 hours overdue.

### Steps
1. Use same commitment from TEST 4 (now 49 hours overdue)
2. Run cron job manually
3. Check `escalation_history` for NEW record with `escalation_type = '48h_overdue'`
4. Verify `escalation_state.current_escalation_level = 2`
5. Verify Manager receives escalation email

### Expected Results
- ✅ NEW `escalation_history` record (escalation_type = '48h_overdue')
- ✅ `escalation_state.current_escalation_level` updated to 2
- ✅ Manager receives email (not Team Lead again)
- ✅ Email subject indicates escalation severity

---

## TEST 6: Escalation - 72h Overdue (Owner)

### Objective
Verify third escalation to owner after 72 hours overdue.

### Steps
1. Use same commitment from TEST 5 (now 73 hours overdue)
2. Run cron job manually
3. Check `escalation_history` for NEW record with `escalation_type = '72h_overdue'`
4. Verify `escalation_state.current_escalation_level = 3`
5. Verify Owner receives escalation email

### Expected Results
- ✅ NEW `escalation_history` record (escalation_type = '72h_overdue')
- ✅ `escalation_state.current_escalation_level` updated to 3
- ✅ Owner receives email
- ✅ No further escalations (max level reached)

---

## TEST 7: Completion Before Reminder

### Objective
Verify no reminder is sent if commitment is completed before reminder window.

### Steps
1. Create commitment due **tomorrow at 2 PM**
2. Before cron runs, update status to 'completed'
3. Run cron job
4. Check logs and database
5. Verify no reminder email is sent

### Expected Results
- ✅ No reminder email received
- ✅ `reminder_sent_at` remains NULL
- ✅ Console logs do NOT show this commitment processed
- ✅ No notification created

### Why This Matters
Completed commitments should never trigger reminders—critical for not bothering users with stale notifications.

---

## TEST 8: Completion After Escalation

### Objective
Verify escalation is cancelled if commitment is completed after escalation.

### Steps
1. Create commitment due **25 hours ago** (eligible for escalation)
2. Run cron job → escalation created
3. Update commitment status to 'completed'
4. Check `escalation_state`: should show `is_resolved = true`
5. Check tasks table: `escalation_cancelled_at` should be set
6. Run cron job again
7. Verify NO NEW escalation is created

### Expected Results
- ✅ `escalation_state.is_resolved = true`
- ✅ `tasks.escalation_cancelled_at` is set to completion time
- ✅ `tasks.escalation_level` reset to 0
- ✅ No duplicate escalation sent on second cron run
- ✅ No email sent for already-resolved commitment

---

## TEST 9: Due Date Change (Earlier)

### Objective
Verify escalation schedule recalculates when due date changes earlier.

### Steps
1. Create commitment due **48 hours from now**
2. Change due date to **25 hours from now** (now eligible for escalation)
3. Run cron job
4. Verify escalation fires immediately (not waiting for original date)

### Expected Results
- ✅ Escalation created despite changing date
- ✅ `escalation_state.next_escalation_due_at` recalculated
- ✅ Manager/Team Lead receive escalation based on new due date

---

## TEST 10: Due Date Change (Later)

### Objective
Verify escalation is voided if due date is moved further into future.

### Steps
1. Create commitment due **25 hours ago** (already overdue, escalation eligible)
2. Run cron → escalation created
3. Change due date to **5 days from now** (no longer overdue)
4. Run cron again
5. Verify NO NEW escalation (existing one should not recur)

### Expected Results
- ✅ Escalation created on first run
- ✅ Second cron run does NOT create new escalation (commitment no longer overdue)
- ✅ Existing escalation remains in history (audit trail)

---

## TEST 11: Reassignment

### Objective
Verify escalation routing changes when commitment is reassigned.

### Steps
1. Create commitment assigned to **Employee A**
2. Escalate to Team Lead
3. Reassign commitment to **Employee B** (different team)
4. Run cron again
5. Verify escalation now routes to Employee B's team lead (not Employee A's team lead)

### Expected Results
- ✅ After reassignment: `tasks.escalation_level = 0` (reset)
- ✅ After reassignment: `tasks.escalation_sent_at = NULL` (reset)
- ✅ New cron run escalates to new assignee's manager
- ✅ No duplicate escalation to old assignee's manager

---

## TEST 12: Idempotency - Duplicate Cron Execution

### Objective
Verify that running cron twice doesn't send duplicate reminders.

### Steps
1. Create commitment due **tomorrow at 2 PM**
2. Run cron job manually: `curl -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3000/api/cron/reminders`
3. **Immediately** run the same command again (within seconds)
4. Check logs for number of reminders/escalations sent
5. Verify only 1 reminder created (not 2)
6. Check `reminder_sent_at`: should be set (idempotent guard succeeded)

### Expected Results
- ✅ First run: `results.reminders.upcoming = 1`
- ✅ Second run: `results.reminders.upcoming = 0` (already processed)
- ✅ Only 1 email received
- ✅ No error in logs about duplicates

### Idempotency Mechanism
- First run: Task `reminder_sent_at IS NULL` → updates to current timestamp
- Second run: Same query finds no tasks with `reminder_sent_at IS NULL` (guard prevents duplicate)

---

## TEST 13: Concurrency - Simultaneous Execution

### Objective
Verify that two concurrent cron processes don't create duplicate escalations.

### Steps
1. Create commitment due **25 hours ago** (eligible for escalation)
2. **Execute two cron requests simultaneously** (in parallel, not sequential):
   ```bash
   # Terminal 1
   curl -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3000/api/cron/reminders &
   # Terminal 2 (while Terminal 1 is running)
   curl -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3000/api/cron/reminders &
   wait
   ```
3. Check `escalation_history` for duplicate entries
4. Count emails received (should be 1, not 2)

### Expected Results
- ✅ `escalation_history` has exactly 1 record (no duplicates)
- ✅ Only 1 escalation email sent to manager
- ✅ Unique constraint on `(task_id, escalated_to_user_id, escalation_type, DATE(created_at))` prevents duplicate
- ✅ Second concurrent process: escalation_created = false (gracefully skipped)

### Idempotency Mechanism
- Escalation uses unique constraint: no two escalations of same type to same person on same day
- First process wins, second process receives constraint violation (gracefully handled)

---

## TEST 14: Multi-Organization Isolation

### Objective
Verify escalations don't leak between organizations.

### Steps
1. Create Org A with Employee A, Team Lead A, Manager A
2. Create Org B with Employee B, Team Lead B, Manager B
3. Create overdue commitment in Org A assigned to Employee A
4. Create overdue commitment in Org B assigned to Employee B
5. Run cron job
6. Check email: Employee A's Team Lead should receive ONE email (for Org A)
7. Check email: Employee B's Team Lead should receive ONE email (for Org B)
8. Verify NO cross-organization email leakage

### Expected Results
- ✅ Team Lead A receives escalation ONLY for Org A commitment
- ✅ Team Lead B receives escalation ONLY for Org B commitment
- ✅ `escalation_history` shows both escalations with correct `organization_id`
- ✅ RLS enforces: Team Lead A cannot query Team Lead B's escalations

---

## TEST 15: Team Isolation

### Objective
Verify escalations respect team membership.

### Steps
1. Create Team 1 with Employee 1, Team Lead 1
2. Create Team 2 with Employee 2, Team Lead 2
3. Create overdue commitment in Team 1 assigned to Employee 1
4. Create overdue commitment in Team 2 assigned to Employee 2
5. Run cron job
6. Verify Team Lead 1 receives escalation for Team 1 commitment only
7. Verify Team Lead 2 receives escalation for Team 2 commitment only

### Expected Results
- ✅ Team Lead 1 escalation only mentions Team 1 commitment
- ✅ Team Lead 2 escalation only mentions Team 2 commitment
- ✅ `escalation_history` shows correct `team_id` for each escalation

---

## TEST 16: No Escalation Past Owner

### Objective
Verify escalation stops at owner level (doesn't try to escalate to non-existent role).

### Steps
1. Create commitment assigned to Manager who is NOT a team lead
2. Due date: 25 hours ago (eligible for escalation)
3. Run cron: Should escalate from Employee → Manager (stop there)
4. Run cron: After 48h, should attempt to escalate to Owner
5. Verify no errors when reaching max escalation level

### Expected Results
- ✅ First escalation: escalates to Manager (escalation_level = 2)
- ✅ Second escalation: escalates to Owner (escalation_level = 3)
- ✅ Third escalation attempt: no error, gracefully handles (no further escalation)
- ✅ Logs show: `"No valid escalation recipient found"` (graceful)

---

## TEST 17: Blocked Commitment Reminder

### Objective
Verify blocked commitments still receive reminders (not suppressed by default).

### Steps
1. Create commitment with status = 'blocked' (if supported)
2. Due date: tomorrow at 2 PM
3. Run cron
4. Verify reminder is sent (blocked status doesn't suppress reminder)
5. Email should mention commitment is blocked

### Expected Results
- ✅ Reminder email received (even though blocked)
- ✅ Email content mentions status or acknowledges blocker
- ✅ Demonstrates that blocked doesn't mean "ignore"

### Note
If 'blocked' status is not a real value, use any status that's not 'completed'/'done'.

---

## TEST 18: Commitment History Audit Trail

### Objective
Verify escalation actions are recorded in `commitment_history` for audit trail.

### Steps
1. Create overdue commitment
2. Run cron to escalate
3. Query `commitment_history` for this commitment
4. Verify entry exists with `change_type = 'updated'` or similar
5. Check `notes` field mentions escalation

### Expected Results
- ✅ `commitment_history` has record of escalation action
- ✅ `change_type` is appropriate ('escalated' or 'updated')
- ✅ Timestamp matches escalation time
- ✅ Audit trail is complete

---

## TEST 19: Email Failure Handling

### Objective
Verify that if email sending fails, the escalation record is still created (in-app notification works).

### Steps
1. Temporarily disable email (rename GMAIL_USER env var or use fake credentials)
2. Create overdue commitment
3. Run cron
4. Verify: `escalation_history` record IS created (status='sent' or 'failed')
5. Check logs for error message (not crash)
6. Re-enable email
7. Verify cron continues processing other commitments

### Expected Results
- ✅ `escalation_history` record created even if email fails
- ✅ Console error logs the failure (not silently ignored)
- ✅ Cron job completes (doesn't crash on one failed email)
- ✅ Next commitment processes normally

---

## TEST 20: Demo Mode Preserved

### Objective
Verify Phase 4 doesn't interfere with demo mode.

### Steps
1. Load demo data using existing "Load Demo" feature
2. Verify demo commitments do NOT trigger escalations
3. Verify demo commitments do NOT send emails
4. Create a real commitment (non-demo) due soon
5. Run cron: verify only real commitment processes

### Expected Results
- ✅ Demo commitments are not escalated
- ✅ No demo-related emails sent
- ✅ Real commitments processed normally
- ✅ Demo mode behavior unchanged

---

## Test Execution Summary

| Test # | Name | Status | Notes |
|--------|------|--------|-------|
| 1 | 24-Hour Reminder | ⏳ | |
| 2 | 1-Hour Reminder | ⏳ | |
| 3 | Overdue Reminder | ⏳ | |
| 4 | 24h Escalation | ⏳ | |
| 5 | 48h Escalation (Manager) | ⏳ | |
| 6 | 72h Escalation (Owner) | ⏳ | |
| 7 | Completion Before Reminder | ⏳ | |
| 8 | Completion After Escalation | ⏳ | |
| 9 | Due Date Change (Earlier) | ⏳ | |
| 10 | Due Date Change (Later) | ⏳ | |
| 11 | Reassignment | ⏳ | |
| 12 | Idempotency - Duplicate Execution | ⏳ | |
| 13 | Concurrency - Simultaneous | ⏳ | |
| 14 | Multi-Org Isolation | ⏳ | |
| 15 | Team Isolation | ⏳ | |
| 16 | No Escalation Past Owner | ⏳ | |
| 17 | Blocked Commitment Reminder | ⏳ | |
| 18 | Commitment History Audit | ⏳ | |
| 19 | Email Failure Handling | ⏳ | |
| 20 | Demo Mode Preserved | ⏳ | |

---

## Verification Checklist

- [ ] All 20 tests executed
- [ ] Build passes with zero errors
- [ ] RLS policies verified (org/team isolation intact)
- [ ] Phase 0 cron protection mechanism still functional
- [ ] Phase 1 terminology preserved
- [ ] Phase 2 realtime unaffected
- [ ] Phase 3 meeting filtering unaffected
- [ ] No duplicate reminders on concurrent execution
- [ ] Completed commitments never escalated
- [ ] Escalation routing correct (team_lead → manager → owner)
- [ ] Email templates professional and clear
- [ ] Idempotency guards working (atomic database operations)
- [ ] Demo mode remains unaffected
- [ ] All database migrations applied successfully

---

## Known Limitations

1. **Email delivery depends on Gmail configuration** - if SMTP fails, ensure credentials are correct
2. **Cron job runs daily** - real-time reminders not supported (future phase)
3. **No user preference for escalation suppression yet** - all overdue commitments escalate
4. **Timezone handling** - uses server timezone; user timezone preferences can be added in future
5. **Slack/Teams escalation delivery** - email only for Phase 4; other channels for Phase 5

