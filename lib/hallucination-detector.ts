import { createClient } from '@supabase/supabase-js';

interface HallucinationCheckResult {
  isHallucination: boolean;
  confidence: number;
  reason: string;
}

export class HallucinationDetector {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Check if extracted commitment likely exists in transcript
   * Uses multiple signals: text matching, owner presence, date references
   */
  async checkExtraction(
    transcript: string,
    taskDescription: string,
    owner: string,
    dueDate: string,
  ): Promise<HallucinationCheckResult> {
    const transcriptLower = transcript.toLowerCase();
    const descriptionLower = taskDescription.toLowerCase();
    const ownerLower = owner.toLowerCase();

    // Extract key terms from description (first few words for better matching)
    const keyTerms = descriptionLower.split(' ').slice(0, 3);

    // Check 1: Key terms in transcript (more lenient than exact substring)
    const hasKeyTerms = keyTerms.some((term) => {
      if (term.length < 3) return true; // Skip very short terms
      return transcriptLower.includes(term);
    });

    // Check 2: Owner mentioned
    const hasOwner = owner !== 'Unassigned' && 
      (transcriptLower.includes(ownerLower) || 
       transcriptLower.includes(owner.split(' ')[0].toLowerCase())); // First name

    // Check 3: Date or deadline mentioned
    const hasDate = this.checkDateInTranscript(transcript, dueDate);

    let confidence = 0;
    let reasons: string[] = [];

    // Scoring: if none of the signals are found, confidence increases
    if (!hasKeyTerms) {
      confidence += 0.4;
      reasons.push('Task description keywords not clearly found in transcript');
    }

    if (!hasOwner && owner !== 'Unassigned') {
      confidence += 0.25;
      reasons.push(`Owner "${owner}" not mentioned in transcript`);
    }

    if (!hasDate && dueDate && dueDate !== 'No deadline') {
      confidence += 0.15;
      reasons.push('No deadline or date reference found in transcript');
    }

    const isHallucination = confidence > 0.5;

    return {
      isHallucination,
      confidence: Math.min(confidence, 1),
      reason: reasons.length > 0 
        ? reasons.join('; ') 
        : 'Extraction verified in transcript',
    };
  }

  /**
   * Flag a potential hallucination for review
   */
  async flagHallucination(
    meetingId: string,
    taskId: string,
    reason: string,
    confidence: number,
  ): Promise<string> {
    // Create hallucination flag
    const { data: flag, error: flagError } = await this.supabase
      .from('hallucination_flags')
      .insert({
        meeting_id: meetingId,
        task_id: taskId,
        reason,
        confidence,
      })
      .select('id')
      .single();

    if (flagError) throw flagError;

    // Set 5-minute grace period on the task
    const graceUntil = new Date();
    graceUntil.setMinutes(graceUntil.getMinutes() + 5);

    await this.supabase
      .from('tasks')
      .update({
        flagged_for_review: true,
        grace_period_ends_at: graceUntil.toISOString(),
      })
      .eq('id', taskId);

    return flag.id;
  }

  /**
   * Get flagged hallucinations for a meeting
   */
  async getFlaggedTasks(meetingId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('hallucination_flags')
      .select('*, tasks(*)')
      .eq('meeting_id', meetingId)
      .eq('resolved', false);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get flagged hallucinations for a user
   */
  async getFlaggedTasksForUser(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*, hallucination_flags(*)')
      .eq('user_id', userId)
      .eq('flagged_for_review', true)
      .neq('grace_period_ends_at', null)
      .order('grace_period_ends_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Check if grace period has expired for a task
   */
  async isGracePeriodExpired(taskId: string): Promise<boolean> {
    const { data: task } = await this.supabase
      .from('tasks')
      .select('grace_period_ends_at')
      .eq('id', taskId)
      .single();

    if (!task || !task.grace_period_ends_at) return true;

    const graceEnd = new Date(task.grace_period_ends_at);
    const now = new Date();

    return now > graceEnd;
  }

  /**
   * Mark hallucination as resolved
   */
  async resolveFlag(flagId: string): Promise<void> {
    await this.supabase
      .from('hallucination_flags')
      .update({ resolved: true })
      .eq('id', flagId);
  }

  /**
   * Clear hallucination flag from task (after grace period expires)
   */
  async clearTaskFlag(taskId: string): Promise<void> {
    await this.supabase
      .from('tasks')
      .update({
        flagged_for_review: false,
        grace_period_ends_at: null,
      })
      .eq('id', taskId);

    // Also resolve any associated flags
    await this.supabase
      .from('hallucination_flags')
      .update({ resolved: true })
      .eq('task_id', taskId)
      .eq('resolved', false);
  }

  private checkDateInTranscript(transcript: string, dueDate: string): boolean {
    if (!dueDate || dueDate === 'No deadline') return true;

    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i,
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(?:today|tomorrow|next\s+week|next\s+month|end\s+of\s+week)\b/i,
      /\b(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    ];

    return datePatterns.some((pattern) => pattern.test(transcript.toLowerCase()));
  }
}
