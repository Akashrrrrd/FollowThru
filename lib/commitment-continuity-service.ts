import { createClient } from '@supabase/supabase-js';

interface CommitmentEvidence {
  id: string;
  taskId: string;
  quote: string;
  timestampInTranscript?: number;
}

export class CommitmentContinuityService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Store evidence for a commitment
   */
  async recordEvidence(
    taskId: string,
    meetingId: string,
    quote: string,
    timestamp?: number,
    sourceUrl?: string,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('commitment_evidence')
      .insert({
        task_id: taskId,
        meeting_id: meetingId,
        quote,
        timestamp_in_transcript: timestamp,
        source_url: sourceUrl,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Get all evidence for a task
   */
  async getTaskEvidence(taskId: string): Promise<CommitmentEvidence[]> {
    const { data, error } = await this.supabase
      .from('commitment_evidence')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      quote: row.quote,
      timestampInTranscript: row.timestamp_in_transcript,
    }));
  }

  /**
   * Get unresolved commitments for a user
   */
  async getUnresolvedCommitments(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*, commitment_evidence(*)')
      .eq('user_id', userId)
      .in('status', ['open', 'in_progress', 'blocked', 'overdue'])
      .neq('state', 'DISMISSED')
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Carry over unresolved commitment to next meeting
   */
  async carryOverCommitment(
    originalTaskId: string,
    carriedOverTaskId: string,
    reason: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('commitment_carryover')
      .insert({
        original_task_id: originalTaskId,
        carried_over_task_id: carriedOverTaskId,
        reason,
      });

    if (error) throw error;
  }

  /**
   * Get carryover history for a task
   */
  async getCarryoverHistory(taskId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('commitment_carryover')
      .select('*')
      .or(`original_task_id.eq.${taskId},carried_over_task_id.eq.${taskId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Calculate days outstanding for a commitment
   */
  async calculateDaysOutstanding(taskId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('due_date, created_at')
      .eq('id', taskId)
      .single();

    if (error) throw error;

    if (!data.due_date) return 0;

    const dueDate = new Date(data.due_date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    return Math.max(0, diff);
  }
}
