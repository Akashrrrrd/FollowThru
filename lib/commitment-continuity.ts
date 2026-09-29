/**
 * Commitment Continuity Matching Logic
 * 
 * Detects when commitments from earlier meetings are being continued,
 * discussed, updated, completed, or delayed in later meetings.
 * 
 * Uses deterministic matching signals (no AI calls):
 * - Identity: owner_user_id match (0.4 weight)
 * - Semantic: entity similarity via Jaccard (0.3 weight)
 * - Temporal: commitment status + follow-up language (0.15 weight)
 * - Status: valid progression rules (0.15 weight)
 */

import type { Task, ContinuityEvidence, ConfidenceLevel } from './types';

// Follow-up language indicators
const FOLLOW_UP_KEYWORDS = [
  'finished', 'completed', 'done', 'ready', 'complete',
  'still working', 'ongoing', 'in progress', 'continuing',
  "couldn't", 'blocked', "can't", 'pending', 'unable',
  'regarding', 'as discussed', 'about that', 'the issue',
  'need more time', 'more days', 'until', 'by',
  'progress', 'update', 'status', 'checked',
];

// Entity extraction: extract key nouns and terms
const ENTITY_REGEX = /\b([a-z]+(?:\s+[a-z]+)*)\b/gi;

/**
 * Extract key entities/terms from a commitment description
 * Returns lowercase terms sorted for consistent comparison
 */
export function extractEntities(text: string): Set<string> {
  const entities = new Set<string>();
  const words = text.toLowerCase().split(/\s+/);
  
  // Add individual words (length > 2 to filter out noise)
  for (const word of words) {
    if (word.length > 2 && !isCommonWord(word)) {
      entities.add(word);
    }
  }
  
  // Add 2-word phrases (important for domain terms)
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = words[i] + ' ' + words[i + 1];
    if (phrase.length > 5 && !isCommonPhrase(phrase)) {
      entities.add(phrase);
    }
  }
  
  return entities;
}

/**
 * Common words to ignore in entity extraction
 */
function isCommonWord(word: string): boolean {
  const common = [
    'the', 'and', 'or', 'a', 'an', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'can', 'must',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its',
    'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
  ];
  return common.includes(word.toLowerCase());
}

/**
 * Common phrases to ignore in entity extraction
 */
function isCommonPhrase(phrase: string): boolean {
  const common = [
    'need to', 'going to', 'have to', 'going to', 'will be',
  ];
  return common.includes(phrase.toLowerCase());
}

/**
 * Calculate Jaccard similarity between two sets
 * Returns 0.0 to 1.0
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;
  
  const arr1 = Array.from(set1);
  const intersection = new Set(arr1.filter(x => set2.has(x)));
  const arr2 = Array.from(set2);
  const union = new Set([...arr1, ...arr2]);
  
  return intersection.size / union.size;
}

/**
 * Detect if text contains follow-up language
 * Returns score 0.0 to 1.0 based on keyword strength
 */
export function detectFollowUpLanguage(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  let matches = 0;
  
  for (const keyword of FOLLOW_UP_KEYWORDS) {
    if (lower.includes(keyword)) {
      matches++;
      // Strong indicators get higher weight
      const strongKeywords = ['finished', 'completed', 'done', 'blocked', "couldn't"];
      if (strongKeywords.includes(keyword)) {
        score += 0.15;
      } else {
        score += 0.08;
      }
    }
  }
  
  // Cap at 1.0
  return Math.min(1.0, score);
}

/**
 * Check if commitment is still open/continuable
 * Returns 0.0 to 1.0
 */
export function getOpenCommitmentScore(task: Task): number {
  if (task.status === 'completed' || task.status === 'done') {
    return 0.3; // Can still be continued if updated/completed
  }
  if (task.status === 'open' || task.status === 'in_progress' || task.status === 'blocked') {
    return 0.9; // Very likely to be continued
  }
  if (task.status === 'overdue') {
    return 0.7; // Potentially continued with reschedule
  }
  return 0.5;
}

/**
 * Check temporal gap penalty
 * Larger gaps reduce confidence
 */
export function getTemporalGapPenalty(originalDate: string, followupDate: string): number {
  try {
    const original = new Date(originalDate);
    const followup = new Date(followupDate);
    const gapDays = Math.floor((followup.getTime() - original.getTime()) / (1000 * 60 * 60 * 24));
    
    if (gapDays > 30) return 0.20; // >30 days: reduce by 0.2
    if (gapDays > 14) return 0.10; // >14 days: reduce by 0.1
    return 0.0; // Recent: no penalty
  } catch {
    return 0.0; // Can't parse dates, no penalty
  }
}

/**
 * Check if status progression is valid
 */
export function isValidStatusProgression(fromStatus: string, toStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'open': ['in_progress', 'blocked', 'completed', 'done', 'overdue'],
    'in_progress': ['blocked', 'completed', 'done', 'overdue', 'open'],
    'blocked': ['in_progress', 'open', 'completed', 'done'],
    'overdue': ['in_progress', 'blocked', 'completed', 'done'],
    'completed': ['done'],
    'done': [],
  };
  
  return (validTransitions[fromStatus] || []).includes(toStatus);
}

/**
 * Score a potential continuity match
 * 
 * Weighted scoring:
 * - Identity (0.4): same owner
 * - Semantic (0.3): entity similarity
 * - Temporal (0.15): status + follow-up language
 * - Status (0.15): valid progression
 * 
 * Returns score 0.0 to 1.0 and detailed evidence
 */
export function scoreCommitmentMatch(
  originalTask: Task,
  newTask: Task,
  newMeetingDate: string,
): { score: number; evidence: ContinuityEvidence } {
  const signals: string[] = [];
  const signalScores: Record<string, number> = {};
  let reasoning = '';
  
  // SIGNAL 1: Identity - Same owner_user_id
  let identityScore = 0;
  if (originalTask.owner_user_id && newTask.owner_user_id) {
    if (originalTask.owner_user_id === newTask.owner_user_id) {
      identityScore = 1.0;
      signals.push('same_owner_user_id');
      reasoning += 'Owner matched by UUID. ';
    } else {
      identityScore = 0.0;
      signals.push('different_owner_user_id');
      reasoning += 'Different owner UUIDs. ';
    }
  } else if (originalTask.owner.toLowerCase() === newTask.owner.toLowerCase()) {
    identityScore = 0.7;
    signals.push('same_owner_name');
    reasoning += 'Owner name matches. ';
  } else {
    identityScore = 0.0;
    signals.push('different_owner');
    reasoning += 'Different owners. ';
  }
  signalScores.identity = identityScore;
  
  // If owners are completely different, confidence is low
  if (identityScore === 0) {
    return {
      score: 0.2,
      evidence: {
        signals,
        signal_scores: signalScores,
        final_score: 0.2,
        reasoning: 'Different owners - not a continuation.',
      },
    };
  }
  
  // SIGNAL 2: Semantic - Entity similarity
  const originalEntities = extractEntities(originalTask.description);
  const newEntities = extractEntities(newTask.description);
  const semanticScore = jaccardSimilarity(originalEntities, newEntities);
  signalScores.semantic = semanticScore;
  signals.push('semantic_match');
  reasoning += `Entity similarity: ${(semanticScore * 100).toFixed(0)}%. `;
  
  // If no common entities and low similarity, likely different commitments
  if (semanticScore < 0.5 && originalEntities.size > 0 && newEntities.size > 0) {
    signals.push('low_entity_overlap');
    reasoning += 'Very different content. ';
  }
  
  // SIGNAL 3: Temporal - Status + Follow-up language
  const openScore = getOpenCommitmentScore(originalTask);
  const followUpScore = detectFollowUpLanguage(newTask.description + ' ' + (newTask.source_quote || ''));
  const temporalScore = (openScore + followUpScore) / 2;
  signalScores.temporal = temporalScore;
  
  if (openScore < 0.5) {
    signals.push('original_already_completed');
    reasoning += 'Original commitment already completed. ';
  }
  if (followUpScore > 0.5) {
    signals.push('follow_up_language_detected');
    reasoning += 'Follow-up language detected. ';
  }
  signalScores.follow_up_language = followUpScore;
  
  // SIGNAL 4: Status Progression
  let statusScore = 0;
  if (isValidStatusProgression(originalTask.status, newTask.status)) {
    statusScore = 0.8;
    signals.push('valid_status_progression');
    reasoning += `Valid status progression: ${originalTask.status} → ${newTask.status}. `;
  } else {
    statusScore = 0.3;
    signals.push('unusual_status_progression');
    reasoning += `Unusual status: ${originalTask.status} → ${newTask.status}. `;
  }
  signalScores.status = statusScore;
  
  // TEMPORAL GAP PENALTY
  const gapPenalty = getTemporalGapPenalty(originalTask.created_at, newMeetingDate);
  if (gapPenalty > 0) {
    signals.push('temporal_gap');
    reasoning += `Temporal gap penalty: -${(gapPenalty * 100).toFixed(0)}%. `;
  }
  signalScores.temporal_gap_penalty = gapPenalty;
  
  // FINAL SCORE CALCULATION
  const finalScore = (
    identityScore * 0.4 +
    semanticScore * 0.3 +
    temporalScore * 0.15 +
    statusScore * 0.15
  ) - gapPenalty;
  
  const clampedScore = Math.max(0.0, Math.min(1.0, finalScore));
  
  return {
    score: clampedScore,
    evidence: {
      signals,
      signal_scores: signalScores,
      final_score: clampedScore,
      reasoning: reasoning.trim(),
    },
  };
}

/**
 * Find the best matching previous commitment for a new task
 * 
 * Returns:
 * - null if no good match found
 * - { task, score, evidence, confidence } if match found
 */
export function findBestPreviousCommitment(
  newTask: Task,
  previousTasks: Task[],
  newMeetingDate: string,
): { task: Task; score: number; evidence: ContinuityEvidence; confidence: ConfidenceLevel } | null {
  // Filter candidates: same owner, open/in_progress/blocked status
  const candidates = previousTasks.filter(
    t => (t.owner_user_id === newTask.owner_user_id || t.owner === newTask.owner) &&
         ['open', 'in_progress', 'blocked', 'overdue'].includes(t.status) &&
         !t.parent_commitment_id, // Don't link to already-linked tasks
  );
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Score all candidates
  const scored = candidates.map(candidate => {
    const { score, evidence } = scoreCommitmentMatch(candidate, newTask, newMeetingDate);
    return { task: candidate, score, evidence };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  
  // Determine confidence level based on score
  let confidence: ConfidenceLevel;
  if (best.score >= 0.85) {
    confidence = 'high';
  } else if (best.score >= 0.65) {
    confidence = 'medium';
  } else {
    return null; // Too low confidence
  }
  
  return {
    task: best.task,
    score: best.score,
    evidence: best.evidence,
    confidence,
  };
}

/**
 * Detect the type of continuity event
 * 
 * Based on status changes, content analysis, and temporal signals:
 * - 'completed': marked as done/completed OR contains completion language
 * - 'blocked': contains blocking language OR status changed to blocked
 * - 'rescheduled': due date changed
 * - 'unblocked': was blocked, now open/in_progress
 * - 'progress': moved from open to in_progress
 * - 'updated': any other follow-up
 */
export function detectEventType(
  originalTask: Task,
  newTask: Task,
): 'completed' | 'rescheduled' | 'blocked' | 'unblocked' | 'progress' | 'updated' {
  const description = (newTask.description + ' ' + (newTask.source_quote || '')).toLowerCase();
  
  // Detect completion by status (highest priority - most reliable)
  if ((newTask.status === 'completed' || newTask.status === 'done') &&
      originalTask.status !== 'completed' &&
      originalTask.status !== 'done') {
    return 'completed';
  }
  
  // Detect completion by language patterns (only strong completion signals)
  // Patterns like "is complete", "has been completed", "the X is done", "finished"
  const strongCompletionPatterns = [
    /\bis\s+(complete|done|ready)\b/,   // "is complete", "is done", "is ready"
    /\bhas\s+been\s+(complete|done)\b/, // "has been completed", "has been done"
    /\bwas\s+\w+?\s+(complete|done)\b/, // "was already completed"
    /^(complete|done|finished)/,        // starts with completion word
    /\b(completed?|finished|ready)\s+(now|already|yesterday|today)\b/, // "completed now", "finished yesterday"
  ];
  
  const hasStrongCompletionLanguage = strongCompletionPatterns.some(pattern => pattern.test(description));
  
  if (hasStrongCompletionLanguage) {
    // But make sure it's not saying negation
    if (!/(haven't|not yet|not complete|not done|incomplete|not\s+ready)/.test(description)) {
      return 'completed';
    }
  }
  
  // Detect rescheduling by due date change (before checking blocking)
  if (newTask.due_date && originalTask.due_date && newTask.due_date !== originalTask.due_date) {
    return 'rescheduled';
  }
  
  // Detect blocking by status (before language, for reliability)
  if (newTask.status === 'blocked' && originalTask.status !== 'blocked') {
    return 'blocked';
  }
  
  // Detect blocking by language
  const blockingPatterns = [
    /\bblocked\b/,
    /can't\s+start/,
    /cannot\s+start/,
    /waiting\s+for/,
    /\bpending\b/,
    /unable\s+to\s+start/,
    /(isn't|is\s+not)\s+ready/,
  ];
  
  const hasBlockingLanguage = blockingPatterns.some(pattern => pattern.test(description));
  if (hasBlockingLanguage) {
    return 'blocked';
  }
  
  // Detect unblocking (was blocked, now open/in_progress)
  if (originalTask.status === 'blocked' && newTask.status !== 'blocked') {
    return 'unblocked';
  }
  
  // Detect progress (open → in_progress)
  if (newTask.status === 'in_progress' && originalTask.status === 'open') {
    return 'progress';
  }
  
  // Default: updated
  return 'updated';
}
