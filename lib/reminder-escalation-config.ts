/**
 * Reminder & Escalation Configuration
 *
 * Centralized policy for reminder and escalation timings.
 * These are DEFAULT SYSTEM RULES and can be extended later
 * with per-organization or per-team customization.
 *
 * All times are in milliseconds unless otherwise noted.
 */

/**
 * Default reminder policy for all commitments
 */
export const DEFAULT_REMINDER_POLICY = {
  /**
   * REMINDER #1: First reminder sent 24 hours before due date
   * Example: If due Oct 10 at 5 PM, reminder sent Oct 9 at 5 PM
   */
  reminder_24h_before_ms: 24 * 60 * 60 * 1000, // 86,400,000 ms

  /**
   * REMINDER #2: Second reminder sent 1 hour before due date
   * Example: If due Oct 10 at 5 PM, reminder sent Oct 10 at 4 PM
   * Only sent if commitment still incomplete
   */
  reminder_1h_before_ms: 60 * 60 * 1000, // 3,600,000 ms

  /**
   * OVERDUE REMINDER: Sent after due time passes if commitment incomplete
   * Checked at first appropriate cron run after due date
   * Example: If due Oct 10 at 5 PM and still open, overdue reminder fires
   */
  overdue_reminder_check_offset_ms: 0, // Fire immediately after due time

  /**
   * ESCALATION: Sent to team lead / manager after commitment overdue for 24 hours
   * Example: If due Oct 10 at 5 PM and cron runs on Oct 11 at 5 PM or later
   */
  escalation_24h_overdue_ms: 24 * 60 * 60 * 1000, // 86,400,000 ms
} as const;

/**
 * Escalation policy: define escalation chain
 */
export const DEFAULT_ESCALATION_POLICY = {
  /**
   * Escalation chain for employee commitments:
   * Employee (has reminder)
   *   ↓
   * Team Lead (if employee is in a team with a team lead)
   *   ↓
   * Manager (if no team lead or escalating further)
   *   ↓
   * Owner (if no managers exist)
   *
   * This matches the existing organization hierarchy from Phase 2.
   */

  /**
   * Steps in escalation (defined in order):
   * 1. Assigned user receives reminder (handled by reminder engine)
   * 2. After 24h overdue, team lead notified (if exists)
   * 3. After 48h overdue, manager notified (if exists)
   * 4. After 72h overdue, owner notified
   */
  escalation_steps: [
    {
      name: 'team_lead',
      hours_overdue: 24,
      description: 'Team Lead receives first escalation',
    },
    {
      name: 'manager',
      hours_overdue: 48,
      description: 'Manager receives escalation if no team lead',
    },
    {
      name: 'owner',
      hours_overdue: 72,
      description: 'Owner receives escalation if no manager',
    },
  ] as const,

  /**
   * Maximum escalation level to prevent cascading to unrelated leadership
   * If employee is themselves a manager: escalate to owner only
   * If employee is owner: no further escalation
   */
  max_escalation_levels: 3,
} as const;

/**
 * Helper: Calculate window start time for reminder eligibility
 * Returns the earliest time a reminder should be sent
 *
 * @param dueDate - ISO string or Date object of when commitment is due
 * @param offsetMs - How many ms before due date to trigger reminder (e.g., 24 * 60 * 60 * 1000 for 24 hours)
 * @returns Date when reminder window opens
 */
export function calculateReminderWindowStart(
  dueDate: string | Date,
  offsetMs: number
): Date {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return new Date(due.getTime() - offsetMs);
}

/**
 * Helper: Check if current time is within reminder window
 *
 * @param dueDate - When commitment is due
 * @param offsetMs - How many ms before due date (24h, 1h, etc.)
 * @param currentTime - Current time to check against (defaults to now)
 * @returns true if reminder should be sent now
 */
export function isReminderDue(
  dueDate: string | Date,
  offsetMs: number,
  currentTime: Date = new Date()
): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const windowStart = new Date(due.getTime() - offsetMs);

  // Reminder is due if:
  // - Current time >= window start (time has arrived or passed)
  // - AND current time < due date (haven't crossed due date yet)
  return currentTime >= windowStart && currentTime < due;
}

/**
 * Helper: Check if commitment is overdue
 *
 * @param dueDate - When commitment was due
 * @param currentTime - Current time to check against (defaults to now)
 * @returns true if due date has passed
 */
export function isCommitmentOverdue(
  dueDate: string | Date,
  currentTime: Date = new Date()
): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  return currentTime > due;
}

/**
 * Helper: Calculate hours overdue
 *
 * @param dueDate - When commitment was due
 * @param currentTime - Current time (defaults to now)
 * @returns Hours overdue (positive if overdue, negative if future)
 */
export function calculateHoursOverdue(
  dueDate: string | Date,
  currentTime: Date = new Date()
): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const diffMs = currentTime.getTime() - due.getTime();
  return diffMs / (60 * 60 * 1000);
}

/**
 * Helper: Check if escalation is due
 *
 * @param dueDate - When commitment was due
 * @param hoursOverdue - How many hours overdue for escalation to trigger
 * @param currentTime - Current time (defaults to now)
 * @returns true if escalation should be sent
 */
export function isEscalationDue(
  dueDate: string | Date,
  hoursOverdue: number,
  currentTime: Date = new Date()
): boolean {
  const actualHoursOverdue = calculateHoursOverdue(dueDate, currentTime);
  return actualHoursOverdue >= hoursOverdue;
}

/**
 * Export policy getter for runtime access
 * Future phases can extend this to load org-specific policies from database
 */
export function getReminderPolicy() {
  return DEFAULT_REMINDER_POLICY;
}

export function getEscalationPolicy() {
  return DEFAULT_ESCALATION_POLICY;
}
