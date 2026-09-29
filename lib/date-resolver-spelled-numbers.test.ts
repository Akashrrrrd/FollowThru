/**
 * Tests for spelled-out number support in date resolver
 * Diagnostic for the issue where Groq returns "in three days" instead of "in 3 days"
 * 
 * These tests validate the fix for three failing commitment cases:
 * 1. "I'll run a mobile performance check in three days" (Maya)
 * 2. "I'll prepare the customer support FAQ in one week" (Sonia)
 * 3. "We'll review the complete relaunch readiness next Wednesday" (Maya)
 */

import { resolveDateExpression, isDependencyExpression } from './date-resolver';

describe('Date Resolver - Spelled-out Numbers', () => {
  // Meeting date: Tuesday, September 29, 2026
  const meetingDate = new Date(2026, 8, 29);
  
  describe('Spelled-out durations', () => {
    test('in three days → should resolve', () => {
      const result = resolveDateExpression('in three days', meetingDate);
      // Expected: 2026-10-02 if resolver supports spelled-out numbers
      // Actual: null if it doesn't
      console.log('in three days:', result);
      expect(result).toBe('2026-10-02');
    });
    
    test('in one week → should resolve', () => {
      const result = resolveDateExpression('in one week', meetingDate);
      // Expected: 2026-10-06
      console.log('in one week:', result);
      expect(result).toBe('2026-10-06');
    });
    
    test('in two weeks → should resolve', () => {
      const result = resolveDateExpression('in two weeks', meetingDate);
      // Expected: 2026-10-13
      console.log('in two weeks:', result);
      expect(result).toBe('2026-10-13');
    });
  });
  
  describe('Comparison: numeric vs spelled-out', () => {
    test('numeric "in 3 days" works', () => {
      const result = resolveDateExpression('in 3 days', meetingDate);
      expect(result).toBe('2026-10-02');
    });
    
    test('spelled "in three days" should also work', () => {
      const result = resolveDateExpression('in three days', meetingDate);
      expect(result).toBe('2026-10-02');
    });
  });
  
  describe('Three failing commitment cases (from diagnostic)', () => {
    test('Case 1: "in three days" (Maya mobile performance check) → 2026-10-02', () => {
      const result = resolveDateExpression('in three days', meetingDate);
      expect(result).toBe('2026-10-02');
    });
    
    test('Case 2: "in one week" (Sonia customer support FAQ) → 2026-10-06', () => {
      const result = resolveDateExpression('in one week', meetingDate);
      expect(result).toBe('2026-10-06');
    });
    
    test('Case 3: "next Wednesday" (Maya relaunch readiness review) → 2026-10-07', () => {
      const result = resolveDateExpression('next Wednesday', meetingDate);
      expect(result).toBe('2026-10-07');
    });
  });
  
  describe('Additional spelled-out number support', () => {
    test('in four days', () => {
      expect(resolveDateExpression('in four days', meetingDate)).toBe('2026-10-03');
    });
    
    test('in five days', () => {
      expect(resolveDateExpression('in five days', meetingDate)).toBe('2026-10-04');
    });
    
    test('in ten days', () => {
      expect(resolveDateExpression('in ten days', meetingDate)).toBe('2026-10-09');
    });
    
    test('in three weeks', () => {
      expect(resolveDateExpression('in three weeks', meetingDate)).toBe('2026-10-20');
    });
  });
});
