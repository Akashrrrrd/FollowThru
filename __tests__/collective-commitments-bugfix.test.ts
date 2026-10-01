/**
 * Task 4-6: Collective Commitments Bug Fix Testing
 * 
 * Tests that the SYSTEM_PROMPT changes correctly:
 * 1. Assign "Unassigned" for collective commitments without named individuals
 * 2. Extract explicit dates from collective commitments
 * 3. Don't regress on individual and named collective commitments
 */

import { callGroqForExtraction, parseCommitments } from '@/lib/groq';

describe('Collective Commitments Owner and Due Date Fix', () => {
  const meetingDate = new Date(2026, 8, 29); // Sept 29, 2026

  describe('Task 4: Bug-Condition Test Cases', () => {
    test('collective with no named person + explicit date => owner=Unassigned', async () => {
      const transcript = "Priya: We'll have a final review meeting on October 8.";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      const commitment = results[0];
      expect(commitment.owner).toBe('Unassigned');
      expect(commitment.due_date).toBe('October 8');
      expect(commitment.commitment_type).toBe('collective');
    });

    test("Let's + no name + date => owner=Unassigned, type=collective", async () => {
      const transcript = "Ananya: Let's finalize the checklist tomorrow.";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      const commitment = results[0];
      expect(commitment.owner).toBe('Unassigned');
      expect(commitment.due_date).toBe('tomorrow');
      expect(commitment.commitment_type).toBe('collective');
    });

    test('collective with named person => owner = named person', async () => {
      const transcript = "Vikram: Let's have Priya validate the numbers by Friday.";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      const commitment = results[0];
      expect(commitment.owner).toBe('Priya');
      expect(commitment.due_date).toBe('by Friday');
      expect(commitment.commitment_type).toBe('collective');
    });

    test('individual explicit => owner = speaker (no regression)', async () => {
      const transcript = "Rahul: I'll send the report by Monday.";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      const commitment = results[0];
      expect(commitment.owner).toBe('Rahul');
      expect(commitment.due_date).toBe('by Monday');
      expect(commitment.commitment_type).toBe('explicit');
    });
  });

  describe('Task 6: Regression Tests - Key Scenarios', () => {
    test('individual with date => no regression', async () => {
      const transcript = "I'll send it by Friday";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].due_date).toBe('by Friday');
      expect(results[0].commitment_type).toBe('explicit');
    });

    test('acceptance => no regression', async () => {
      const transcript = "Sure, I'll prepare it by tomorrow";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].commitment_type).toBe('acceptance');
      expect(results[0].due_date).toBe('by tomorrow');
    });

    test('named collective => no regression', async () => {
      const transcript = "Let's have Priya test it";
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].owner).toBe('Priya');
      expect(results[0].commitment_type).toBe('collective');
    });

    test('collective with relative date => no regression', async () => {
      const transcript = 'We should finalize this next week';
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].owner).toBe('Unassigned');
      expect(results[0].due_date).toBe('next week');
    });

    test('dependency-only => no regression', async () => {
      const transcript = 'I can review it once you send it';
      const results = await callGroqForExtraction(transcript, meetingDate);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].dependency).toBeTruthy();
      expect(results[0].due_date).toBeNull();
    });
  });
});