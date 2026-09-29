/**
 * Commitment Lifecycle Utilities
 * 
 * Handles status transitions, overdue logic, and lifecycle state management.
 */

import type { Task, TaskStatus } from './types';

/**
 * Valid status transitions for commitments.
 * Maps from current status to allowed next statuses.
 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['in_progress', 'blocked', 'completed'],
  in_progress: ['blocked', 'completed', 'open'],
  blocked: ['in_progress', 'open', 'completed'],
  completed: [], // Cannot transition from completed
  overdue: [], // Overdue is derived, not a stored status
  done: ['in_progress', 'blocked', 'completed'], // Legacy 'done' treated as 'open' equivalent
};

/**
 * Check if a status transition is valid.
 * 
 * @param currentStatus - The current status
 * @param newStatus - The requested new status
 * @returns true if the transition is allowed, false otherwise
 */
export function isValidTransition(currentStatus: TaskStatus, newStatus: TaskStatus): boolean {
  // Treat 'overdue' as 'open' for transition purposes (overdue is derived, not stored)
  let normalizedCurrentStatus = currentStatus;
  if (currentStatus === 'overdue') {
    normalizedCurrentStatus = 'open';
  }
  
  // Legacy 'done' is treated like a stored completed state, cannot transition further
  if (normalizedCurrentStatus === 'done' && newStatus !== 'in_progress' && newStatus !== 'blocked' && newStatus !== 'completed') {
    return false;
  }
  
  const allowedTransitions = VALID_TRANSITIONS[normalizedCurrentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Determine if a task should be displayed as overdue.
 * Overdue is a derived display state, not a stored status.
 * 
 * @param task - The task to check
 * @param todayDate - The date to use as "today" (defaults to current date)
 * @returns true if task should display as overdue
 */
export function isOverdue(task: Task, todayDate: Date = new Date()): boolean {
  // Never overdue if no due date
  if (!task.due_date) return false;
  
  // Never overdue if completed
  if (task.status === 'completed' || task.status === 'done') return false;
  
  // Compare dates
  const dueDate = new Date(task.due_date + 'T00:00:00');
  const today = new Date(todayDate);
  today.setHours(0, 0, 0, 0);
  
  return dueDate < today;
}

/**
 * Get the display status for a task (accounting for overdue).
 * If task is overdue, display as "overdue" even if status is "open" or "in_progress".
 * 
 * @param task - The task to check
 * @param todayDate - The date to use as "today"
 * @returns The display status
 */
export function getDisplayStatus(task: Task, todayDate?: Date): TaskStatus {
  if (isOverdue(task, todayDate)) {
    return 'overdue';
  }
  return task.status;
}

/**
 * Normalize legacy 'done' status to 'completed'.
 * Used for UI display and counts.
 * 
 * @param status - The status to normalize
 * @returns 'completed' if input is 'done', otherwise the input status
 */
export function normalizeStatus(status: TaskStatus): TaskStatus {
  if (status === 'done') return 'completed';
  return status;
}

/**
 * Get a human-readable status label.
 * 
 * @param status - The status
 * @returns Human-readable label
 */
export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    completed: 'Completed',
    overdue: 'Overdue',
    done: 'Done', // Legacy, shouldn't normally be displayed
  };
  return labels[status] || 'Unknown';
}

/**
 * Get CSS classes for status badge styling.
 * 
 * @param status - The status
 * @returns CSS class string for styling
 */
export function getStatusStyles(status: TaskStatus): {
  badge: string;
  bg: string;
  text: string;
} {
  const styles: Record<
    TaskStatus,
    { badge: string; bg: string; text: string }
  > = {
    open: {
      badge: 'bg-gray-100 text-gray-700',
      bg: 'bg-gray-50',
      text: 'text-gray-600',
    },
    in_progress: {
      badge: 'bg-blue-100 text-blue-700',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
    },
    blocked: {
      badge: 'bg-amber-100 text-amber-700',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
    },
    completed: {
      badge: 'bg-green-100 text-green-700',
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
    overdue: {
      badge: 'bg-red-100 text-red-700',
      bg: 'bg-red-50',
      text: 'text-red-600',
    },
    done: {
      badge: 'bg-green-100 text-green-700',
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
  };
  
  return styles[status] || styles.open;
}
