import { HallucinationDetector } from '@/lib/hallucination-detector';
import { createClient } from '@supabase/supabase-js';

const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  })),
};

describe('Phase 1: AI Hallucination Protection', () => {
  let detector: HallucinationDetector;

  beforeEach(() => {
    detector = new HallucinationDetector(mockSupabase as any);
  });

  describe('checkExtraction', () => {
    it('should detect valid extraction in transcript', async () => {
      const transcript = 'John will complete the report by Friday, October 4th';
      const result = await detector.checkExtraction(
        transcript,
        'complete the report',
        'John',
        'Friday',
      );

      expect(result.isHallucination).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should detect hallucination when description not in transcript', async () => {
      const transcript = 'We discussed the project timeline';
      const result = await detector.checkExtraction(
        transcript,
        'fix the quantum computing algorithm',
        'Alice',
        'Monday',
      );

      expect(result.isHallucination).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should handle Unassigned owner without flagging missing owner', async () => {
      const transcript = 'Someone should review the code';
      const result = await detector.checkExtraction(
        transcript,
        'review the code',
        'Unassigned',
        'No deadline',
      );

      expect(result.reason).not.toContain('Owner name not found');
    });

    it('should detect missing date references', async () => {
      const transcript = 'We need to fix the bug';
      const result = await detector.checkExtraction(
        transcript,
        'fix the bug',
        'Unassigned',
        'December 25, 2025',
      );

      // Date not in transcript should increase confidence
      expect(result.confidence).toBeGreaterThanOrEqual(0.2);
    });

    it('should calculate confidence correctly for mixed scenarios', async () => {
      const transcript = 'Alice will write documentation next week';
      const result = await detector.checkExtraction(
        transcript,
        'write documentation',
        'Bob', // Different person
        'next week',
      );

      expect(result.confidence).toBeLessThan(1);
      expect(result.reason).toContain('Owner name not found');
    });
  });

  describe('flagHallucination', () => {
    it('should flag hallucination with correct parameters', async () => {
      await detector.flagHallucination(
        'meeting-123',
        'task-456',
        'Description not in transcript',
        0.8,
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('hallucination_flags');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty transcript', async () => {
      const result = await detector.checkExtraction(
        '',
        'some task',
        'someone',
        'tomorrow',
      );

      expect(result.isHallucination).toBe(true);
    });

    it('should handle very long descriptions', async () => {
      const longDesc = 'a'.repeat(500);
      const transcript = 'We need to work on a very long task about aaaaaa';
      const result = await detector.checkExtraction(
        transcript,
        longDesc,
        'John',
        'Friday',
      );

      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('isHallucination');
    });

    it('should handle special characters in names', async () => {
      const transcript = "Jean-Pierre will finish d'Orsay's presentation";
      const result = await detector.checkExtraction(
        transcript,
        "finish d'Orsay's presentation",
        "Jean-Pierre",
        'Friday',
      );

      expect(result).toHaveProperty('confidence');
    });
  });

  describe('Date detection', () => {
    it('should recognize various date formats', async () => {
      const dates = [
        '01/15/2025',
        'January 15',
        'Monday',
        'next week',
        'tomorrow',
      ];

      for (const date of dates) {
        const transcript = `Task due ${date}`;
        const result = await detector.checkExtraction(
          transcript,
          'complete task',
          'Unassigned',
          date,
        );

        expect(result).toHaveProperty('isHallucination');
      }
    });
  });
});
