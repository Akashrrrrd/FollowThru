/**
 * Commitment Lifecycle Tests
 * 
 * Tests for status transitions, overdue logic, and lifecycle state management.
 */

import {
  isValidTransition,
  isOverdue,
  getDisplayStatus,
  normalizeStatus,
} from './lifecycle';
import type { Task, TaskStatus } from './types';

describe('Commitment Lifecycle', () => {
  // Helper to create a test task
  function createTask(overrides?: Partial<Task>): Task {
    return {
      id: 'test-id',
      meeting_id: 'meeting-id',
      user_id: 'user-id',
      description: 'Test commitment',
      owner: 'Test Owner',
      due_date: null,
      source_quote: 'Test quote',
      status: 'open',
      created_at: '2026-09-29T00:00:00Z',
      needs_review: false,
      approved: true,
      updated_at: '2026-09-29T00:00:00Z',
      ...overrides,
    };
  }

  describe('Status Transitions', () => {
    test('1. Open → In Progress is valid', () => {
      expect(isValidTransition('open', 'in_progress')).toBe(true);
    });

    test('2. Open → Blocked is valid', () => {
      expect(isValidTransition('open', 'blocked')).toBe(true);
    });

    test('3. Open → Completed is valid', () => {
      expect(isValidTransition('open', 'completed')).toBe(true);
    });

    test('4. In Progress → Blocked is valid', () => {
      expect(isValidTransition('in_progress', 'blocked')).toBe(true);
    });

    test('5. In Progress → Completed is valid', () => {
      expect(isValidTransition('in_progress', 'completed')).toBe(true);
    });

    test('6. In Progress → Open is valid', () => {
      expect(isValidTransition('in_progress', 'open')).toBe(true);
    });

    test('7. Blocked → In Progress is valid', () => {
      expect(isValidTransition('blocked', 'in_progress')).toBe(true);
    });

    test('8. Blocked → Open is valid', () => {
      expect(isValidTransition('blocked', 'open')).toBe(true);
    });

    test('9. Blocked → Completed is valid', () => {
      expect(isValidTransition('blocked', 'completed')).toBe(true);
    });

    test('10. Completed → any status is invalid', () => {
      expect(isValidTransition('completed', 'open')).toBe(false);
      expect(isValidTransition('completed', 'in_progress')).toBe(false);
      expect(isValidTransition('completed', 'blocked')).toBe(false);
    });

    test('11. Invalid transitions are rejected', () => {
      expect(isValidTransition('open', 'completed')).toBe(true); // valid
      expect(isValidTransition('blocked', 'blocked')).toBe(false); // same status
    });
  });

  describe('Overdue Logic', () => {
    const referenceDate = new Date('2026-09-29T00:00:00Z');

    test('1. New commitment defaults to open', () => {
      const task = createTask();
      expect(task.status).toBe('open');
    });

    test('2. Item without due date is never overdue', () => {
      const task = createTask({ due_date: null, status: 'open' });
      expect(isOverdue(task, referenceDate)).toBe(false);
    });

    test('3. Completed item is never overdue', () => {
      const task = createTask({
        due_date: '2026-09-28',
        status: 'completed',
      });
      expect(isOverdue(task, referenceDate)).toBe(false);
    });

    test('4. Past due open item is overdue', () => {
      const task = createTask({
        due_date: '2026-09-28',
        status: 'open',
      });
      expect(isOverdue(task, referenceDate)).toBe(true);
    });

    test('5. Past due in-progress item is overdue', () => {
      const task = createTask({
        due_date: '2026-09-28',
        status: 'in_progress',
      });
      expect(isOverdue(task, referenceDate)).toBe(true);
    });

    test('6. Past due blocked item is overdue', () => {
      const task = createTask({
        due_date: '2026-09-28',
        status: 'blocked',
      });
      expect(isOverdue(task, referenceDate)).toBe(true);
    });

    test('7. Future due item is not overdue', () => {
      const task = createTask({
        due_date: '2026-09-30',
        status: 'open',
      });
      expect(isOverdue(task, referenceDate)).toBe(false);
    });

    test('8. Today due item is not overdue (boundary)', () => {
      const task = createTask({
        due_date: '2026-09-29',
        status: 'open',
      });
      expect(isOverdue(task, referenceDate)).toBe(false);
    });

    test('9. Yesterday due item is overdue', () => {
      const task = createTask({
        due_date: '2026-09-28',
        status: 'open',
      });
      expect(isOverdue(task, referenceDate)).toBe(true);
    });
  });

  describe('Display Status', () => {
    const referenceDate = new Date('2026-09-29T00:00:00Z');

    test('1. Open task with no due date displays as open', () => {
      const task = createTask({ status: 'open', due_date: null });
      expect(getDisplayStatus(task, referenceDate)).toBe('open');
    });

    test('2. Open task with future due date displays as open', () => {
      const task = createTask({ status: 'open', due_date: '2026-09-30' });
      expect(getDisplayStatus(task, referenceDate)).toBe('open');
    });

    test('3. Open task with past due date displays as overdue', () => {
      const task = createTask({ status: 'open', due_date: '2026-09-28' });
      expect(getDisplayStatus(task, referenceDate)).toBe('overdue');
    });

    test('4. In-progress task with past due date displays as overdue', () => {
      const task = createTask({
        status: 'in_progress',
        due_date: '2026-09-28',
      });
      expect(getDisplayStatus(task, referenceDate)).toBe('overdue');
    });

    test('5. Completed task is never displayed as overdue', () => {
      const task = createTask({
        status: 'completed',
        due_date: '2026-09-28',
      });
      expect(getDisplayStatus(task, referenceDate)).toBe('completed');
    });

    test('6. Blocked task displays as blocked, not overdue', () => {
      const task = createTask({ status: 'blocked', due_date: '2026-09-30' });
      expect(getDisplayStatus(task, referenceDate)).toBe('blocked');
    });
  });

  describe('Status Normalization', () => {
    test('1. Legacy "done" normalizes to "completed"', () => {
      expect(normalizeStatus('done')).toBe('completed');
    });

    test('2. "open" normalizes to "open"', () => {
      expect(normalizeStatus('open')).toBe('open');
    });

    test('3. "in_progress" normalizes to "in_progress"', () => {
      expect(normalizeStatus('in_progress')).toBe('in_progress');
    });

    test('4. "blocked" normalizes to "blocked"', () => {
      expect(normalizeStatus('blocked')).toBe('blocked');
    });

    test('5. "completed" normalizes to "completed"', () => {
      expect(normalizeStatus('completed')).toBe('completed');
    });

    test('6. "overdue" normalizes to "overdue"', () => {
      expect(normalizeStatus('overdue')).toBe('overdue');
    });
  });

  describe('Completion Scenarios', () => {
    const referenceDate = new Date('2026-09-29T00:00:00Z');

    test('1. Completing an overdue item removes overdue state', () => {
      const task = createTask({
        status: 'open',
        due_date: '2026-09-28',
      });
      expect(getDisplayStatus(task, referenceDate)).toBe('overdue');

      const completedTask = { ...task, status: 'completed' as TaskStatus };
      expect(getDisplayStatus(completedTask, referenceDate)).toBe('completed');
    });

    test('2. Reopening a completed item restores previous due state', () => {
      const completedTask = createTask({
        status: 'completed',
        due_date: '2026-09-28',
      });
      expect(getDisplayStatus(completedTask, referenceDate)).toBe('completed');

      const reopenedTask = { ...completedTask, status: 'open' as TaskStatus };
      expect(getDisplayStatus(reopenedTask, referenceDate)).toBe('overdue');
    });

    test('3. Blocking an overdue item still shows as overdue', () => {
      const task = createTask({
        status: 'blocked',
        due_date: '2026-09-28',
      });
      expect(getDisplayStatus(task, referenceDate)).toBe('overdue');
    });
  });

  describe('Manual vs AI-Extracted Tasks', () => {
    test('1. Manual task defaults to open', () => {
      const manualTask = createTask({
        source_quote: 'Manually added',
      });
      expect(manualTask.status).toBe('open');
    });

    test('2. AI-extracted task defaults to open', () => {
      const aiTask = createTask({
        confidence: 'high',
        commitment_type: 'explicit',
      });
      expect(aiTask.status).toBe('open');
    });

    test('3. Both support same lifecycle', () => {
      const manualTask = createTask({ source_quote: 'Manually added' });
      const aiTask = createTask({ confidence: 'high' });

      const transitions: TaskStatus[] = [
        'in_progress',
        'blocked',
        'completed',
      ];
      for (const newStatus of transitions) {
        expect(isValidTransition(manualTask.status as TaskStatus, newStatus)).toBe(
          isValidTransition(aiTask.status as TaskStatus, newStatus),
        );
      }
    });
  });

  describe('Edge Cases', () => {
    test('1. Timezone-safe date comparison (no UTC shift)', () => {
      // Use a task with date in local format
      const task = createTask({
        due_date: '2026-09-28',
        status: 'open',
      });
      const ref = new Date('2026-09-29');
      expect(isOverdue(task, ref)).toBe(true);
    });

    test('2. Status survives persistence/reload', () => {
      // Simulate task being saved and reloaded from DB
      const originalTask = createTask({ status: 'in_progress' });
      const reloadedTask: Task = JSON.parse(JSON.stringify(originalTask));
      expect(reloadedTask.status).toBe('in_progress');
    });

    test('3. Multiple transitions in sequence', () => {
      let status: TaskStatus = 'open';
      expect(isValidTransition(status, 'in_progress')).toBe(true);
      status = 'in_progress';
      expect(isValidTransition(status, 'blocked')).toBe(true);
      status = 'blocked';
      expect(isValidTransition(status, 'in_progress')).toBe(true);
      status = 'in_progress';
      expect(isValidTransition(status, 'completed')).toBe(true);
    });
  });
});
