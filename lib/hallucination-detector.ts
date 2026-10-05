// lib/hallucination-detector.ts
export const GRACE_PERIOD_MINUTES = 5;
const FLAG_THRESHOLD = 0.5;

interface HallucinationCheckResult {
  isHallucination: boolean;
  confidence: number;
  reason: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'will', 'have', 'has', 'from', 'are', 'was', 'were',
  'been', 'can', 'could', 'would', 'should', 'you', 'your', 'our', 'their', 'them', 'they', 'his',
  'her', 'she', 'him', 'who', 'what', 'when', 'where', 'which', 'also', 'just', 'into', 'about',
  'after', 'before', 'then', 'than', 'get', 'got', 'let', 'make', 'need', 'needs', 'going', 'gonna',
  'able', 'please', 'all', 'any', 'but', 'not', 'out', 'one', 'new',
]);

const GENERIC_OWNERS = ['unassigned', 'team', 'everyone', 'everybody', 'all', 'we', 'tbd'];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:"'`()[\]{}\-–—_/\\*#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const contentWords = (s: string) =>
  normalize(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

const stem = (w: string) => w.slice(0, 5);

export class HallucinationDetector {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Scores how likely a commitment is NOT supported by the transcript.
   * Signals: source quote present, description keywords, owner mentioned, date mentioned.
   */
  async checkExtraction(
    transcript: string,
    taskDescription: string,
    owner: string,
    dueDate: string,
    sourceQuote?: string | null,
  ): Promise<HallucinationCheckResult> {
    const t = normalize(transcript);
    const transcriptWords = new Set(t.split(' '));
    const transcriptStems = new Set(Array.from(transcriptWords, stem));
    const wordFound = (w: string) => transcriptWords.has(w) || transcriptStems.has(stem(w));

    let score = 0;
    const reasons: string[] = [];

    // 1. Source quote: the strongest signal. It should appear in the transcript.
    const quote = normalize(sourceQuote || '');
    if (!quote) {
      score += 0.3;
      reasons.push('No supporting quote was provided for this commitment');
    } else if (!t.includes(quote)) {
      const qWords = contentWords(quote);
      const found = qWords.filter(wordFound).length;
      const ratio = qWords.length ? found / qWords.length : 0;
      if (ratio < 0.7) {
        score += 0.45;
        reasons.push(
          `Source quote not found in the transcript (${Math.round(ratio * 100)}% of its key words match)`,
        );
      }
    }

    // 2. Description keywords should appear in the transcript.
    const dWords = contentWords(taskDescription);
    if (dWords.length) {
      const ratio = dWords.filter(wordFound).length / dWords.length;
      if (ratio < 0.3) {
        score += 0.4;
        reasons.push('Most keywords from the task description are missing from the transcript');
      } else if (ratio < 0.5) {
        score += 0.2;
        reasons.push('Only some keywords from the task description appear in the transcript');
      }
    }

    // 3. Owner should be mentioned (skip generic owners).
    const ownerNorm = normalize(owner || '');
    if (ownerNorm && !GENERIC_OWNERS.includes(ownerNorm)) {
      const first = ownerNorm.split(' ')[0];
      const mentioned = t.includes(ownerNorm) || (first.length >= 3 && t.includes(first));
      if (!mentioned) {
        score += 0.2;
        reasons.push(`Owner "${owner}" is not mentioned in the transcript`);
      }
    }

    // 4. A deadline should have some date reference.
    if (dueDate && dueDate !== 'No deadline' && !this.checkDateInTranscript(transcript, dueDate)) {
      score += 0.1;
      reasons.push('No deadline or date reference found in the transcript');
    }

    return {
      isHallucination: score >= FLAG_THRESHOLD,
      confidence: Math.min(score, 1),
      reason: reasons.length ? reasons.join('; ') : 'Extraction verified in transcript',
    };
  }

  /** Flags a task for review and starts the grace period. Safe to call twice. */
  async flagHallucination(
    meetingId: string,
    taskId: string,
    reason: string,
    confidence: number,
  ): Promise<string> {
    const { data: existing } = await this.supabase
      .from('hallucination_flags')
      .select('id')
      .eq('task_id', taskId)
      .eq('resolved', false)
      .limit(1);

    let flagId: string | undefined = existing?.[0]?.id;

    if (!flagId) {
      const { data: flag, error: flagError } = await this.supabase
        .from('hallucination_flags')
        .insert({ meeting_id: meetingId, task_id: taskId, reason, confidence })
        .select('id')
        .single();
      if (flagError) throw flagError;
      flagId = flag.id as string;
    }

    const graceUntil = new Date(Date.now() + GRACE_PERIOD_MINUTES * 60_000);
    const { error: taskError } = await this.supabase
      .from('tasks')
      .update({ flagged_for_review: true, grace_period_ends_at: graceUntil.toISOString() })
      .eq('id', taskId);
    if (taskError) throw taskError;

    return flagId;
  }

  async getFlaggedTasks(meetingId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('hallucination_flags')
      .select('*, tasks(*)')
      .eq('meeting_id', meetingId)
      .eq('resolved', false);
    if (error) throw error;
    return data || [];
  }

  async getFlaggedTasksForUser(userId: string): Promise<any[]> {
    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*, hallucination_flags(*)')
      .eq('user_id', userId)
      .eq('flagged_for_review', true)
      .not('grace_period_ends_at', 'is', null) // grace_period_ends_at is set
      .gt('grace_period_ends_at', nowIso) // and hasn't expired yet
      .order('grace_period_ends_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async isGracePeriodExpired(taskId: string): Promise<boolean> {
    const { data: task } = await this.supabase
      .from('tasks')
      .select('grace_period_ends_at')
      .eq('id', taskId)
      .single();
    if (!task || !task.grace_period_ends_at) return true;
    return new Date() > new Date(task.grace_period_ends_at);
  }

  async resolveFlag(flagId: string): Promise<void> {
    await this.supabase.from('hallucination_flags').update({ resolved: true }).eq('id', flagId);
  }

  async clearTaskFlag(taskId: string): Promise<void> {
    await this.supabase
      .from('tasks')
      .update({ flagged_for_review: false, grace_period_ends_at: null })
      .eq('id', taskId);
    await this.supabase
      .from('hallucination_flags')
      .update({ resolved: true })
      .eq('task_id', taskId)
      .eq('resolved', false);
  }

  /**
   * Auto-keeps commitments whose review window has ended (no cron needed;
   * called whenever the pending list is loaded). Returns how many were cleared.
   */
  async clearExpiredFlags(userId: string): Promise<number> {
    const nowIso = new Date().toISOString();
    const { data: expired, error } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('flagged_for_review', true)
      .or(`grace_period_ends_at.is.null,grace_period_ends_at.lt.${nowIso}`);
    if (error) throw error;
    if (!expired || expired.length === 0) return 0;

    const ids = expired.map((t: any) => t.id);
    await this.supabase
      .from('tasks')
      .update({ flagged_for_review: false, grace_period_ends_at: null })
      .in('id', ids);
    await this.supabase
      .from('hallucination_flags')
      .update({ resolved: true })
      .in('task_id', ids)
      .eq('resolved', false);
    return ids.length;
  }

  private checkDateInTranscript(transcript: string, dueDate: string): boolean {
    if (!dueDate || dueDate === 'No deadline') return true;
    const patterns = [
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/,
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i,
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(?:today|tonight|tomorrow|next\s+week|next\s+month|end\s+of\s+(?:day|week|month|quarter)|eod|eow|q[1-4])\b/i,
      /\b(?:this|next)\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    ];
    return patterns.some((p) => p.test(transcript));
  }
}