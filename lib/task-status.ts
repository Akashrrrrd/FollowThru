import { isOverdue } from '@/lib/lifecycle';
import type { Task } from '@/lib/types';

export type CardStatus = 'overdue' | 'soon' | 'progress' | 'done' | 'blocked' | 'neutral';

export const DUE_SOON_DAYS = 7;

/**
 * Whole calendar days from today until the due date.
 * Negative = past due, 0 = today, null = no (or invalid) date.
 */
export function calendarDaysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;

  const due = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function isDueSoon(task: Task): boolean {
  const days = calendarDaysUntil(task.due_date);
  return days !== null && days <= DUE_SOON_DAYS;
}

/**
 * The single source of truth for a commitment's visual status.
 * Pass `done: true` to force "done" (e.g. while a completion is still saving).
 */
export function cardStatusOf(task: Task, opts: { done?: boolean } = {}): CardStatus {
  if (opts.done || task.status === 'completed' || task.status === 'done') return 'done';
  if (isOverdue(task)) return 'overdue';
  if (task.status === 'blocked') return 'blocked';
  if (isDueSoon(task)) return 'soon';
  if (task.status === 'in_progress') return 'progress';
  return 'neutral';
}

/** "Overdue by 3 days", "Due today", "Due tomorrow", "Due in 5 days", or null. */
export function relativeDueLabel(dateStr?: string | null): string | null {
  const days = calendarDaysUntil(dateStr);
  if (days === null) return null;

  if (days < 0) {
    const n = Math.abs(days);
    return `Overdue by ${n} day${n === 1 ? '' : 's'}`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= DUE_SOON_DAYS) return `Due in ${days} days`;
  return null;
}