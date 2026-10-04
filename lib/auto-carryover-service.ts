/**
 * Auto-Carryover Service
 * 
 * Automatically carries over unresolved commitments from previous meetings
 * into new meetings. When a user creates/extracts a new meeting, all open
 * commitments are made available for quick re-association.
 */

import { createServerClient } from './supabase-server';
import type { Task } from './types';

interface CarryoverCandidate {
  id: string;
  description: string;
  owner: string;
  owner_user_id?: string;
  due_date?: string;
  status: string;
  source_meeting_id: string;
  source_meeting_title: string;
  days_outstanding: number;
  blocker?: boolean;
  blocker_text?: string;
}

/**
 * Find open commitments eligible for carryover
 * Returns tasks that are still open, blocked, or overdue
 */
export async function findCarryoverCandidates(
  userId: string,
  excludeMeetingId?: string,
): Promise<CarryoverCandidate[]> {
  const supabase = createServerClient();

  // Fetch open/overdue/blocked tasks from user's previous meetings
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(
      `
      id,
      description,
      owner,
      owner_user_id,
      due_date,
      status,
      meeting_id,
      blocker,
      created_at,
      meetings!inner (title)
    `,
    )
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress', 'blocked', 'overdue'])
    .is('parent_commitment_id', null); // Only original commitments, not linked ones

  if (error) {
    console.error('[CARRYOVER] Error fetching candidates:', error);
    return [];
  }

  if (!tasks) {
    return [];
  }

  const today = new Date();

  return tasks
    .filter((task: any) => {
      // Skip if excluded meeting
      if (excludeMeetingId && task.meeting_id === excludeMeetingId) {
        return false;
      }
      return true;
    })
    .map((task: any) => {
      // Calculate days outstanding
      let daysOutstanding = 0;
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const daysDifference = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        daysOutstanding = Math.max(0, daysDifference); // Negative means still in future
      }

      return {
        id: task.id,
        description: task.description,
        owner: task.owner,
        owner_user_id: task.owner_user_id,
        due_date: task.due_date,
        status: task.status,
        source_meeting_id: task.meeting_id,
        source_meeting_title: (task.meetings as any)?.title || 'Unknown Meeting',
        days_outstanding: daysOutstanding,
        blocker: task.blocker ? true : false,
        blocker_text: task.blocker,
      };
    })
    .sort((a, b) => {
      // Sort by: urgency (overdue first), then by days_outstanding descending
      const aUrgent = a.status === 'overdue' ? 1 : 0;
      const bUrgent = b.status === 'overdue' ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return b.days_outstanding - a.days_outstanding;
    });
}

/**
 * Create a carryover task (link existing commitment to new meeting)
 * This creates a "continued" commitment in the new meeting
 */
export async function createCarryoverTask(
  newMeetingId: string,
  originalTaskId: string,
  userId: string,
): Promise<Task | null> {
  const supabase = createServerClient();

  // Fetch the original task and the new meeting's organization
  const { data: originalTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', originalTaskId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !originalTask) {
    console.error('[CARRYOVER] Failed to fetch original task:', fetchError);
    return null;
  }

  // Get organization_id from the new meeting
  const { data: newMeeting, error: meetingError } = await supabase
    .from('meetings')
    .select('organization_id')
    .eq('id', newMeetingId)
    .single();

  if (meetingError || !newMeeting) {
    console.error('[CARRYOVER] Failed to fetch new meeting:', meetingError);
    return null;
  }

  // Create new task in the new meeting that references the original
  const { data: newTask, error: createError } = await supabase
    .from('tasks')
    .insert({
      meeting_id: newMeetingId,
      user_id: userId,
      organization_id: newMeeting.organization_id,
      description: originalTask.description,
      owner: originalTask.owner,
      owner_user_id: originalTask.owner_user_id,
      due_date: originalTask.due_date,
      source_quote: `[Carried over from previous meeting] ${originalTask.source_quote}`,
      confidence: 'high',
      commitment_type: 'explicit',
      parent_commitment_id: originalTaskId,
      continuity_status: 'continued',
      continuity_confidence: 'high',
      blocker: originalTask.blocker,
      status: 'open', // Start as open in the new meeting
    })
    .select()
    .single();

  if (createError) {
    console.error('[CARRYOVER] Failed to create carryover task:', createError);
    return null;
  }

  // Log the carryover event
  await supabase.from('commitment_history').insert({
    task_id: newTask.id,
    user_id: userId,
    change_type: 'carried_over',
    new_value: 'open',
    notes: `Automatically carried over from meeting: ${originalTask.meeting_id}`,
  });

  console.log(`[CARRYOVER] Created carryover task ${newTask.id} from original ${originalTaskId}`);

  return newTask;
}

/**
 * Batch create carryover tasks
 * Called when new meeting is created with list of commitment IDs to carry over
 */
export async function batchCreateCarryoverTasks(
  newMeetingId: string,
  originalTaskIds: string[],
  userId: string,
): Promise<{
  created: Task[];
  failed: string[];
}> {
  const created: Task[] = [];
  const failed: string[] = [];

  for (const taskId of originalTaskIds) {
    try {
      const newTask = await createCarryoverTask(newMeetingId, taskId, userId);
      if (newTask) {
        created.push(newTask);
      } else {
        failed.push(taskId);
      }
    } catch (err) {
      console.error(`[CARRYOVER] Error creating carryover for ${taskId}:`, err);
      failed.push(taskId);
    }
  }

  console.log(`[CARRYOVER] Batch carryover complete: ${created.length} created, ${failed.length} failed`);

  return { created, failed };
}

/**
 * Get summary of carryover candidates for UI display
 */
export async function getCarryoverSummary(userId: string): Promise<{
  totalOpen: number;
  totalOverdue: number;
  totalBlocked: number;
  topUrgent: CarryoverCandidate[];
}> {
  const candidates = await findCarryoverCandidates(userId);

  return {
    totalOpen: candidates.filter((c) => c.status === 'open').length,
    totalOverdue: candidates.filter((c) => c.status === 'overdue').length,
    totalBlocked: candidates.filter((c) => c.status === 'blocked').length,
    topUrgent: candidates.slice(0, 5),
  };
}
