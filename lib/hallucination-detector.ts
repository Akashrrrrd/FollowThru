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

    // Basic checks
    const hasDescription = transcriptLower.includes(descriptionLower.substring(0, 20));
    const hasOwner = owner !== 'Unassigned' && transcriptLower.includes(ownerLower);
    const hasDate = this.checkDateInTranscript(transcript, dueDate);

    let confidence = 0;
    let reasons: string[] = [];

    if (!hasDescription) {
      confidence += 0.4;
      reasons.push('Task description not found in transcript');
    }

    if (!hasOwner && owner !== 'Unassigned') {
      confidence += 0.2;
      reasons.push('Owner name not found in transcript');
    }

    if (!hasDate && dueDate && dueDate !== 'No deadline') {
      confidence += 0.2;
      reasons.push('Due date not found in transcript');
    }

    const isHallucination = confidence > 0.5;

    return {
      isHallucination,
      confidence: Math.min(confidence, 1),
      reason: reasons.join('; ') || 'Extraction verified in transcript',
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
  ): Promise<void> {
    await this.supabase.from('hallucination_flags').insert({
      meeting_id: meetingId,
      task_id: taskId,
      reason,
      confidence,
    });
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
   * Mark hallucination as resolved
   */
  async resolveFlag(flagId: string): Promise<void> {
    await this.supabase
      .from('hallucination_flags')
      .update({ resolved: true })
      .eq('id', flagId);
  }

  private checkDateInTranscript(transcript: string, dueDate: string): boolean {
    if (!dueDate || dueDate === 'No deadline') return true;

    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i,
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(?:today|tomorrow|next\s+week|next\s+month)\b/i,
    ];

    return datePatterns.some((pattern) => pattern.test(transcript.toLowerCase()));
  }
}
