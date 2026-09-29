/**
 * Conflict Detector for FollowThru
 * 
 * Identifies and reports on data consistency issues:
 * - Duplicate commitments (same task from multiple sources)
 * - False merges (tasks incorrectly linked as continuations)
 * - Orphaned tasks (tasks without valid meeting references)
 * - Conflicting commitments (contradictory ownership or due dates)
 * 
 * Core invariant: Each real-world commitment should appear exactly once
 * in the task database, even if mentioned in multiple meetings.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ConflictReport {
  totalConflicts: number;
  hasDuplicates: boolean;
  hasFalseMerges: boolean;
  hasOrphans: boolean;
  hasConflicts: boolean;
  details: {
    duplicates: DuplicateCommitment[];
    falseMerges: FalseMergeLink[];
    orphans: OrphanedTask[];
    conflicts: CommitmentConflict[];
  };
  summary: string;
}

export interface DuplicateCommitment {
  taskIds: string[];
  description: string;
  owner: string;
  meetingIds: string[];
  severity: 'high' | 'medium' | 'low';
  evidence: {
    descriptionSimilarity: number;
    sameMeeting?: boolean;
    createdWithinMinutes?: number;
  };
}

export interface FalseMergeLink {
  parentTaskId: string;
  childTaskId: string;
  reason: string;
  severity: 'high' | 'medium';
  evidence: {
    dateMismatch?: boolean;
    ownerMismatch?: boolean;
    descriptionDissimilarity?: number;
  };
}

export interface OrphanedTask {
  taskId: string;
  description: string;
  meetingId: string | null;
  severity: 'high' | 'medium';
}

export interface CommitmentConflict {
  taskId: string;
  description: string;
  conflictType: 'owner_mismatch' | 'date_mismatch' | 'status_mismatch';
  values: string[];
  severity: 'medium' | 'high';
}

/**
 * Similarity score between two strings (0 to 1)
 * Simple algorithm: longest common substring ratio
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Longer string should be compared against shorter string
  if (s1.length < s2.length) {
    return calculateStringSimilarity(str2, str1);
  }

  // If shorter string is empty, similarity is 0
  if (s2.length === 0) {
    return 0;
  }

  // Find longest common substring
  let maxLength = 0;
  for (let i = 0; i < s1.length; i++) {
    for (let j = 0; j < s2.length; j++) {
      let length = 0;
      while (
        i + length < s1.length &&
        j + length < s2.length &&
        s1[i + length] === s2[j + length]
      ) {
        length++;
      }
      maxLength = Math.max(maxLength, length);
    }
  }

  return maxLength / Math.max(s1.length, s2.length);
}

/**
 * Detect duplicate commitments (same task mentioned multiple times)
 */
export async function detectDuplicates(
  supabase: SupabaseClient,
  userId: string
): Promise<DuplicateCommitment[]> {
  const duplicates: DuplicateCommitment[] = [];

  // Fetch all tasks for the user
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, description, owner, meeting_id, created_at, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !tasks) {
    return duplicates;
  }

  // Group tasks by owner first, then check descriptions within each owner group
  const tasksByOwner = new Map<string, typeof tasks>();

  for (const task of tasks) {
    if (!tasksByOwner.has(task.owner)) {
      tasksByOwner.set(task.owner, []);
    }
    tasksByOwner.get(task.owner)!.push(task);
  }

  // For each owner, find duplicate descriptions
  tasksByOwner.forEach((ownerTasks, owner) => {
    if (ownerTasks.length < 2) return;

    // Check each pair of tasks for high similarity
    const processed = new Set<string>();

    for (let i = 0; i < ownerTasks.length; i++) {
      for (let j = i + 1; j < ownerTasks.length; j++) {
        const task1 = ownerTasks[i];
        const task2 = ownerTasks[j];

        // Skip if already grouped
        const key = [task1.id, task2.id].sort().join('_');
        if (processed.has(key)) continue;

        const sim = calculateStringSimilarity(task1.description, task2.description);

        if (sim >= 0.85) {
          // High similarity - mark as duplicate
          processed.add(key);

          const meetingIds = [task1.meeting_id, task2.meeting_id].filter(Boolean) as string[];
          const sameMeeting = new Set(meetingIds).size === 1 && meetingIds.length > 0;

          const times = [task1.created_at, task2.created_at].map((t) =>
            new Date(t).getTime()
          );
          const minTime = Math.min(...times);
          const maxTime = Math.max(...times);
          const minutesApart = (maxTime - minTime) / (1000 * 60);

          duplicates.push({
            taskIds: [task1.id, task2.id],
            description: task1.description,
            owner,
            meetingIds,
            severity:
              minutesApart < 60 ? 'high' : minutesApart < 1440 ? 'medium' : 'low',
            evidence: {
              descriptionSimilarity: sim,
              sameMeeting,
              createdWithinMinutes: Math.round(minutesApart),
            },
          });
        }
      }
    }
  });

  return duplicates;
}

/**
 * Detect false merge links (tasks marked as continuations but shouldn't be)
 */
export async function detectFalseMerges(
  supabase: SupabaseClient,
  userId: string
): Promise<FalseMergeLink[]> {
  const falseMerges: FalseMergeLink[] = [];

  // Fetch all tasks with parent task ID references
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, description, owner, due_date, parent_task_id, status, created_at')
    .eq('user_id', userId);

  if (error || !tasks) {
    return falseMerges;
  }

  // Create a map for quick lookup
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Check each task with a parent reference
  for (const task of tasks) {
    if (task.parent_task_id) {
      const parent = taskMap.get(task.parent_task_id);
      if (!parent) continue;

      const issues: string[] = [];
      const evidence: FalseMergeLink['evidence'] = {};

      // Check for owner mismatch
      if (parent.owner !== task.owner) {
        issues.push(`owner mismatch: "${parent.owner}" vs "${task.owner}"`);
        evidence.ownerMismatch = true;
      }

      // Check for date conflicts
      if (parent.due_date && task.due_date) {
        const parentDate = new Date(parent.due_date);
        const taskDate = new Date(task.due_date);
        if (taskDate < parentDate) {
          issues.push(`child due before parent: ${task.due_date} < ${parent.due_date}`);
          evidence.dateMismatch = true;
        }
      }

      // Check for description dissimilarity
      const descSim = calculateStringSimilarity(parent.description, task.description);
      if (descSim < 0.3) {
        issues.push(`descriptions dissimilar: ${(descSim * 100).toFixed(0)}% match`);
        evidence.descriptionDissimilarity = descSim;
      }

      if (issues.length > 0) {
        falseMerges.push({
          parentTaskId: parent.id,
          childTaskId: task.id,
          reason: issues.join('; '),
          severity: issues.length > 2 ? 'high' : 'medium',
          evidence,
        });
      }
    }
  }

  return falseMerges;
}

/**
 * Detect orphaned tasks (tasks without valid meeting references)
 */
export async function detectOrphans(
  supabase: SupabaseClient,
  userId: string
): Promise<OrphanedTask[]> {
  const orphans: OrphanedTask[] = [];

  // Fetch all tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, description, meeting_id')
    .eq('user_id', userId);

  if (tasksError || !tasks) {
    return orphans;
  }

  // Fetch all meetings for this user to get valid meeting IDs
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('id')
    .eq('user_id', userId);

  if (meetingsError || !meetings) {
    return orphans;
  }

  const validMeetingIds = new Set(meetings.map((m) => m.id));

  // Check each task
  for (const task of tasks) {
    if (!task.meeting_id) {
      // Task with no meeting reference
      orphans.push({
        taskId: task.id,
        description: task.description,
        meetingId: null,
        severity: 'high',
      });
    } else if (!validMeetingIds.has(task.meeting_id)) {
      // Task references non-existent meeting
      orphans.push({
        taskId: task.id,
        description: task.description,
        meetingId: task.meeting_id,
        severity: 'high',
      });
    }
  }

  return orphans;
}

/**
 * Detect commitment conflicts (same task with conflicting data)
 */
export async function detectConflicts(
  supabase: SupabaseClient,
  userId: string
): Promise<CommitmentConflict[]> {
  const conflicts: CommitmentConflict[] = [];

  // For now, just identify tasks with conflicting data within themselves
  // (This would be expanded with more sophisticated conflict detection)
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, description, owner, due_date, status')
    .eq('user_id', userId);

  if (error || !tasks) {
    return conflicts;
  }

  // Check for data quality issues
  for (const task of tasks) {
    // Status should be reasonable
    const validStatuses = ['open', 'completed', 'carried_over', 'archived'];
    if (task.status && !validStatuses.includes(task.status)) {
      conflicts.push({
        taskId: task.id,
        description: task.description,
        conflictType: 'status_mismatch',
        values: [task.status],
        severity: 'medium',
      });
    }

    // Future dates should be in a reasonable range
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      const yearsAhead = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);

      if (yearsAhead > 5) {
        conflicts.push({
          taskId: task.id,
          description: task.description,
          conflictType: 'date_mismatch',
          values: [task.due_date],
          severity: 'medium',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Run full conflict detection suite
 */
export async function runFullConflictDetection(
  supabase: SupabaseClient,
  userId: string
): Promise<ConflictReport> {
  const [duplicates, falseMerges, orphans, conflicts] = await Promise.all([
    detectDuplicates(supabase, userId),
    detectFalseMerges(supabase, userId),
    detectOrphans(supabase, userId),
    detectConflicts(supabase, userId),
  ]);

  const totalConflicts =
    duplicates.length + falseMerges.length + orphans.length + conflicts.length;

  const summary =
    totalConflicts === 0
      ? '✓ No conflicts detected'
      : `✗ Found ${totalConflicts} conflict(s): ` +
        [
          duplicates.length > 0 && `${duplicates.length} duplicate(s)`,
          falseMerges.length > 0 && `${falseMerges.length} false merge(s)`,
          orphans.length > 0 && `${orphans.length} orphan(s)`,
          conflicts.length > 0 && `${conflicts.length} conflict(s)`,
        ]
          .filter(Boolean)
          .join(', ');

  return {
    totalConflicts,
    hasDuplicates: duplicates.length > 0,
    hasFalseMerges: falseMerges.length > 0,
    hasOrphans: orphans.length > 0,
    hasConflicts: conflicts.length > 0,
    details: {
      duplicates,
      falseMerges,
      orphans,
      conflicts,
    },
    summary,
  };
}
