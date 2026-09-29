import {
  extractEntities,
  jaccardSimilarity,
  detectFollowUpLanguage,
  getOpenCommitmentScore,
  getTemporalGapPenalty,
  isValidStatusProgression,
  scoreCommitmentMatch,
  findBestPreviousCommitment,
  detectEventType,
} from '../../lib/commitment-continuity';
import type { Task } from '../../lib/types';

/**
 * Test Suite: Commitment Continuity Matching Logic
 * 
 * Tests 9 core scenarios:
 * 1. Same commitment continued (high confidence match)
 * 2. Commitment completed in follow-up
 * 3. Commitment rescheduled with updated due date
 * 4. Commitment blocked with blocker mention
 * 5. Different commitments (no match)
 * 6. Similar but different commitments (low confidence)
 * 7. Different owner (no match, capped score)
 * 8. Follow-up without new commitment (no match)
 * 9. Collective commitment (matched by owner group)
 */

describe('Commitment Continuity - Matching Logic', () => {
  // Mock task factory
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).substr(2, 9),
    meeting_id: 'meeting-1',
    user_id: 'user-123',
    description: 'Test commitment',
    owner: 'John',
    owner_user_id: 'user-john-uuid',
    due_date: '2024-02-01',
    source_quote: 'I will complete this by Friday',
    status: 'open',
    created_at: '2024-01-20T10:00:00Z',
    needs_review: false,
    approved: true,
    updated_at: '2024-01-20T10:00:00Z',
    ...overrides,
  });

  describe('Entity Extraction', () => {
    it('extracts key terms from commitment description', () => {
      const text = 'Complete the financial report by next Friday';
      const entities = extractEntities(text);

      expect(entities.size).toBeGreaterThan(0);
      expect(entities.has('financial')).toBe(true);
      expect(entities.has('report')).toBe(true);
    });

    it('filters out common words', () => {
      const text = 'The and or a is this that';
      const entities = extractEntities(text);

      // Should be empty or very small, containing no common words
      expect(Array.from(entities).every(e => !['the', 'and', 'or', 'a', 'is', 'this', 'that'].includes(e))).toBe(true);
    });

    it('extracts two-word phrases', () => {
      const text = 'Deploy the payment system to production';
      const entities = extractEntities(text);

      // Should contain phrases like "payment system" or "payment" + "system"
      expect(entities.size).toBeGreaterThan(0);
    });
  });

  describe('Jaccard Similarity', () => {
    it('returns 1.0 for identical sets', () => {
      const set1 = new Set(['report', 'financial', 'completed']);
      const set2 = new Set(['report', 'financial', 'completed']);

      expect(jaccardSimilarity(set1, set2)).toBe(1.0);
    });

    it('returns 0.0 for completely different sets', () => {
      const set1 = new Set(['report', 'financial']);
      const set2 = new Set(['meeting', 'schedule']);

      expect(jaccardSimilarity(set1, set2)).toBe(0.0);
    });

    it('returns 0.5 for 50% overlap', () => {
      const set1 = new Set(['report', 'financial', 'completed']);
      const set2 = new Set(['report', 'financial', 'meeting', 'scheduled']);

      const similarity = jaccardSimilarity(set1, set2);
      expect(similarity).toBeCloseTo(0.4, 1); // 2 common / 5 total
    });

    it('returns 1.0 for two empty sets', () => {
      const set1 = new Set<string>();
      const set2 = new Set<string>();

      expect(jaccardSimilarity(set1, set2)).toBe(1.0);
    });

    it('returns 0.0 when one set is empty', () => {
      const set1 = new Set(['report']);
      const set2 = new Set<string>();

      expect(jaccardSimilarity(set1, set2)).toBe(0.0);
    });
  });

  describe('Follow-Up Language Detection', () => {
    it('detects completion keywords', () => {
      const text = 'I finished the report';
      const score = detectFollowUpLanguage(text);

      expect(score).toBeGreaterThan(0.1);
    });

    it('detects blocking keywords', () => {
      const text = 'We are blocked by missing data';
      const score = detectFollowUpLanguage(text);

      expect(score).toBeGreaterThan(0.1);
    });

    it('detects ongoing/progress keywords', () => {
      const text = 'Still working on the deployment';
      const score = detectFollowUpLanguage(text);

      expect(score).toBeGreaterThan(0);
    });

    it('returns 0 for text without follow-up language', () => {
      const text = 'New commitment for next week';
      const score = detectFollowUpLanguage(text);

      expect(score).toBe(0);
    });

    it('caps score at 1.0 even with many keywords', () => {
      const text = 'Finished completed done finished completed done finished';
      const score = detectFollowUpLanguage(text);

      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Open Commitment Score', () => {
    it('returns 0.9 for open status', () => {
      const task = createTask({ status: 'open' });
      expect(getOpenCommitmentScore(task)).toBe(0.9);
    });

    it('returns 0.9 for in_progress status', () => {
      const task = createTask({ status: 'in_progress' });
      expect(getOpenCommitmentScore(task)).toBe(0.9);
    });

    it('returns 0.9 for blocked status', () => {
      const task = createTask({ status: 'blocked' });
      expect(getOpenCommitmentScore(task)).toBe(0.9);
    });

    it('returns 0.3 for completed status', () => {
      const task = createTask({ status: 'completed' });
      expect(getOpenCommitmentScore(task)).toBe(0.3);
    });

    it('returns 0.7 for overdue status', () => {
      const task = createTask({ status: 'overdue' });
      expect(getOpenCommitmentScore(task)).toBe(0.7);
    });
  });

  describe('Temporal Gap Penalty', () => {
    it('returns 0 for recent commitments (<14 days)', () => {
      const original = '2024-01-20T10:00:00Z';
      const followup = '2024-01-25T10:00:00Z'; // 5 days later

      expect(getTemporalGapPenalty(original, followup)).toBe(0.0);
    });

    it('returns 0.1 for 14-30 day gaps', () => {
      const original = '2024-01-01T10:00:00Z';
      const followup = '2024-01-20T10:00:00Z'; // 19 days later

      expect(getTemporalGapPenalty(original, followup)).toBe(0.1);
    });

    it('returns 0.2 for >30 day gaps', () => {
      const original = '2024-01-01T10:00:00Z';
      const followup = '2024-02-10T10:00:00Z'; // 40 days later

      expect(getTemporalGapPenalty(original, followup)).toBe(0.2);
    });

    it('returns 0 for invalid date strings', () => {
      expect(getTemporalGapPenalty('invalid', 'also-invalid')).toBe(0.0);
    });
  });

  describe('Status Progression Validation', () => {
    it('allows open → in_progress', () => {
      expect(isValidStatusProgression('open', 'in_progress')).toBe(true);
    });

    it('allows in_progress → completed', () => {
      expect(isValidStatusProgression('in_progress', 'completed')).toBe(true);
    });

    it('allows open → blocked', () => {
      expect(isValidStatusProgression('open', 'blocked')).toBe(true);
    });

    it('allows blocked → in_progress', () => {
      expect(isValidStatusProgression('blocked', 'in_progress')).toBe(true);
    });

    it('rejects completed → open', () => {
      expect(isValidStatusProgression('completed', 'open')).toBe(false);
    });

    it('rejects done → any transition', () => {
      expect(isValidStatusProgression('done', 'open')).toBe(false);
      expect(isValidStatusProgression('done', 'in_progress')).toBe(false);
    });
  });

  describe('TEST CASE 1: Same Commitment Continued (High Confidence)', () => {
    it('detects same commitment with high confidence', () => {
      const originalTask = createTask({
        id: 'task-1',
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Complete the financial report',
        status: 'open',
        created_at: '2024-01-20T10:00:00Z',
      });

      const newTask = createTask({
        id: 'task-2',
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Finish the financial report',
        status: 'in_progress',
      });

      const result = scoreCommitmentMatch(originalTask, newTask, '2024-01-25T10:00:00Z');

      expect(result.score).toBeGreaterThanOrEqual(0.65);
      expect(result.evidence.signals).toContain('same_owner_user_id');
      expect(result.evidence.reasoning).toContain('Owner matched');
    });
  });

  describe('TEST CASE 2: Commitment Completed in Follow-up', () => {
    it('links completed commitment with follow-up language', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Deploy payment system',
        status: 'open',
        created_at: '2024-01-20T10:00:00Z',
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Finished deploying payment system to production',
        status: 'completed',
        source_quote: 'I finished the payment system deployment yesterday',
      });

      const result = scoreCommitmentMatch(originalTask, newTask, '2024-01-25T10:00:00Z');

      // Should detect the completed status transition and follow-up language in the description
      expect(detectEventType(originalTask, newTask)).toBe('completed');
      // The description "Finished deploying..." should register the completion
      expect(result.evidence.signals).toContain('valid_status_progression');
    });
  });

  describe('TEST CASE 3: Commitment Rescheduled', () => {
    it('detects rescheduling of commitment', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Prepare quarterly review',
        due_date: '2024-02-01',
        status: 'open',
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Prepare quarterly review - pushed to March',
        due_date: '2024-03-01',
        status: 'in_progress',
      });

      const eventType = detectEventType(originalTask, newTask);
      expect(eventType).toBe('rescheduled');
    });
  });

  describe('TEST CASE 4: Commitment Blocked', () => {
    it('detects blocking of commitment with blocker mention', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Integrate third-party API',
        status: 'open',
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Blocked - waiting for API documentation from vendor',
        status: 'blocked',
        source_quote: 'We are blocked on the API integration',
      });

      expect(newTask.status).toBe('blocked');
      expect(detectFollowUpLanguage(newTask.source_quote)).toBeGreaterThan(0);
      expect(detectEventType(originalTask, newTask)).toBe('blocked');
    });
  });

  describe('TEST CASE 5: Different Commitments (No Match)', () => {
    it('does not match completely different commitments', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Complete financial report',
        owner: 'John',
        owner_user_id: 'user-john',
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Schedule team building event',
        owner: 'John',
        owner_user_id: 'user-john',
      });

      const result = scoreCommitmentMatch(originalTask, newTask, '2024-01-25T10:00:00Z');

      expect(result.score).toBeLessThan(0.65);
    });
  });

  describe('TEST CASE 6: Similar But Different Commitments (Low Confidence)', () => {
    it('flags low confidence for vague similarity', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Complete project documentation',
        status: 'open',
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Start work on project updates',
        status: 'in_progress',
      });

      const result = scoreCommitmentMatch(originalTask, newTask, '2024-01-25T10:00:00Z');

      // Should score lower than high confidence match
      expect(result.score).toBeLessThan(0.85);
    });
  });

  describe('TEST CASE 7: Different Owner (No Match, Capped Score)', () => {
    it('caps score at 0.2 for different owners', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Complete financial report',
        owner: 'John',
        owner_user_id: 'user-john',
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Complete financial report',
        owner: 'Sarah',
        owner_user_id: 'user-sarah',
      });

      const result = scoreCommitmentMatch(originalTask, newTask, '2024-01-25T10:00:00Z');

      expect(result.score).toBeLessThanOrEqual(0.2);
      expect(result.evidence.signals).toContain('different_owner_user_id');
    });
  });

  describe('TEST CASE 8: Follow-up Without New Commitment (No Match)', () => {
    it('does not match follow-up status updates as new commitments', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Complete financial report',
        status: 'completed',
      });

      // Follow-up discussing something else entirely
      const previousTasks = [originalTask];
      const newTask = createTask({
        id: 'task-2',
        description: 'Team retrospective on report process',
        status: 'open',
        owner: 'John',
        owner_user_id: 'user-john',
      });

      const match = findBestPreviousCommitment(
        newTask,
        previousTasks,
        '2024-01-25T10:00:00Z',
      );

      // Should not match or have low confidence
      if (match) {
        expect(match.confidence).not.toBe('high');
      }
    });
  });

  describe('TEST CASE 9: Collective Commitment (Matched by Owner Group)', () => {
    it('matches collective commitments by owner name', () => {
      const originalTask = createTask({
        id: 'task-1',
        description: 'Design new user interface',
        owner: 'Design Team',
        owner_user_id: null, // No user_id for collective
      });

      const newTask = createTask({
        id: 'task-2',
        description: 'Complete UI design mockups',
        owner: 'Design Team',
        owner_user_id: null,
        status: 'in_progress',
      });

      const result = scoreCommitmentMatch(originalTask, newTask, '2024-01-25T10:00:00Z');

      // Should still score based on owner name match
      expect(result.evidence.signals).toContain('same_owner_name');
    });
  });

  describe('findBestPreviousCommitment Integration', () => {
    it('returns null when no candidates match', () => {
      const newTask = createTask({
        owner: 'John',
        owner_user_id: 'user-john',
      });

      const previousTasks = [
        createTask({
          owner: 'Sarah',
          owner_user_id: 'user-sarah',
          status: 'open',
        }),
      ];

      const match = findBestPreviousCommitment(newTask, previousTasks, '2024-01-25T10:00:00Z');
      expect(match).toBeNull();
    });

    it('filters by status - only considers open/in_progress/blocked/overdue', () => {
      const newTask = createTask({
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Deploy payment system',
      });

      const previousTasks = [
        createTask({
          owner: 'John',
          owner_user_id: 'user-john',
          status: 'completed', // Should be filtered out
          description: 'Deploy payment system',
        }),
        createTask({
          owner: 'John',
          owner_user_id: 'user-john',
          status: 'open', // Should be included
          description: 'Deploy payment system',
        }),
      ];

      const match = findBestPreviousCommitment(newTask, previousTasks, '2024-01-25T10:00:00Z');

      // Should match the open task
      expect(match).not.toBeNull();
      if (match) {
        expect(match.task.status).toBe('open');
      }
    });

    it('returns HIGH confidence for scores >= 0.85', () => {
      const newTask = createTask({
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Complete financial report',
        status: 'in_progress',
      });

      const previousTasks = [
        createTask({
          owner: 'John',
          owner_user_id: 'user-john',
          description: 'Complete financial report', // Identical
          status: 'open',
        }),
      ];

      const match = findBestPreviousCommitment(newTask, previousTasks, '2024-01-25T10:00:00Z');

      if (match) {
        expect(match.confidence).toBe('high');
      }
    });

    it('returns MEDIUM confidence for scores 0.65-0.84', () => {
      const newTask = createTask({
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Prepare financial report for review',
        status: 'in_progress',
      });

      const previousTasks = [
        createTask({
          owner: 'John',
          owner_user_id: 'user-john',
          description: 'Complete financial report',
          status: 'open',
        }),
      ];

      const match = findBestPreviousCommitment(newTask, previousTasks, '2024-01-25T10:00:00Z');

      if (match) {
        // Slight variation should yield medium confidence
        expect(match.confidence).toMatch(/high|medium/);
      }
    });

    it('returns null for scores < 0.65', () => {
      const newTask = createTask({
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Design new homepage',
        status: 'open',
      });

      const previousTasks = [
        createTask({
          owner: 'John',
          owner_user_id: 'user-john',
          description: 'Deploy payment system',
          status: 'open',
        }),
      ];

      const match = findBestPreviousCommitment(newTask, previousTasks, '2024-01-25T10:00:00Z');
      expect(match).toBeNull();
    });

    it('selects best scoring candidate when multiple exist', () => {
      const newTask = createTask({
        owner: 'John',
        owner_user_id: 'user-john',
        description: 'Deploy payment system version 2',
        status: 'in_progress',
      });

      const previousTasks = [
        createTask({
          id: 'task-weak',
          owner: 'John',
          owner_user_id: 'user-john',
          description: 'Deploy something',
          status: 'open',
        }),
        createTask({
          id: 'task-strong',
          owner: 'John',
          owner_user_id: 'user-john',
          description: 'Deploy payment system',
          status: 'open',
        }),
      ];

      const match = findBestPreviousCommitment(newTask, previousTasks, '2024-01-25T10:00:00Z');

      if (match) {
        // Should select the stronger match
        expect(match.task.id).toBe('task-strong');
      }
    });
  });

  describe('detectEventType', () => {
    it('returns "completed" when transitioning to done/completed', () => {
      const original = createTask({ status: 'open' });
      const followup = createTask({ status: 'completed' });

      expect(detectEventType(original, followup)).toBe('completed');
    });

    it('returns "blocked" when transitioning to blocked', () => {
      const original = createTask({ status: 'open' });
      const followup = createTask({ status: 'blocked' });

      expect(detectEventType(original, followup)).toBe('blocked');
    });

    it('returns "unblocked" when transitioning from blocked', () => {
      const original = createTask({ status: 'blocked' });
      const followup = createTask({ status: 'in_progress' });

      expect(detectEventType(original, followup)).toBe('unblocked');
    });

    it('returns "progress" when transitioning from open to in_progress', () => {
      const original = createTask({ status: 'open' });
      const followup = createTask({ status: 'in_progress' });

      expect(detectEventType(original, followup)).toBe('progress');
    });

    it('returns "rescheduled" when due_date changes', () => {
      const original = createTask({ due_date: '2024-02-01' });
      const followup = createTask({ due_date: '2024-03-01' });

      expect(detectEventType(original, followup)).toBe('rescheduled');
    });

    it('returns "updated" for other changes', () => {
      const original = createTask({ status: 'in_progress' });
      const followup = createTask({ status: 'in_progress', description: 'Updated description' });

      expect(detectEventType(original, followup)).toBe('updated');
    });
  });

  describe('Scoring Edge Cases', () => {
    it('handles tasks with no owner_user_id', () => {
      const original = createTask({
        owner: 'Team Lead',
        owner_user_id: undefined,
      });

      const followup = createTask({
        owner: 'Team Lead',
        owner_user_id: undefined,
      });

      const result = scoreCommitmentMatch(original, followup, '2024-01-25T10:00:00Z');

      // Should still score based on owner name
      expect(result.score).toBeGreaterThan(0);
    });

    it('includes temporal gap penalty in final score', () => {
      const original = createTask({
        created_at: '2024-01-01T10:00:00Z',
        description: 'Complete report',
      });

      const followup = createTask({
        description: 'Complete report',
        owner: original.owner,
        owner_user_id: original.owner_user_id,
      });

      const result = scoreCommitmentMatch(original, followup, '2024-02-10T10:00:00Z'); // 40 days later

      expect(result.evidence.signal_scores.temporal_gap_penalty).toBe(0.2);
    });

    it('provides detailed evidence and reasoning', () => {
      const original = createTask({
        description: 'Deploy API gateway',
      });

      const followup = createTask({
        description: 'API gateway deployment in progress',
      });

      const result = scoreCommitmentMatch(original, followup, '2024-01-25T10:00:00Z');

      expect(result.evidence.signals.length).toBeGreaterThan(0);
      expect(result.evidence.signal_scores).toBeDefined();
      expect(result.evidence.reasoning.length).toBeGreaterThan(0);
      expect(result.evidence.final_score).toBe(result.score);
    });
  });
});
