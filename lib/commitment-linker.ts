/**
 * Commitment Linker
 * 
 * Integrates commitment continuity matching into the extraction flow.
 * Called after Groq extracts commitments to link them with previous commitments.
 * 
 * IMPORTANT: This now updates the ORIGINAL commitment in addition to linking the new one.
 * When Meeting 2 provides new information about a Meeting 1 commitment, we:
 * 1. Update the original commitment's status/due_date based on the new meeting
 * 2. Link the new task to the original
 * 3. Create continuity events for audit trail
 */

import { createServerClient } from './supabase-server';
import {
  findBestPreviousCommitment,
  detectEventType,
} from './commitment-continuity';
import type { Task, ExtractedCommitment, ContinuityEventType } from './types';

/**
 * Link newly extracted commitments with previous ones AND update originals
 * 
 * Returns:
 * - Array of newly extracted commitments with parent_commitment_id set if linked
 * - Continuity event records to be inserted
 * - List of original task IDs that were updated (for UI/logging)
 */
export async function linkCommitmentsToPrevious(
  newCommitments: Task[],
  meetingId: string,
  userId: string,
  newMeetingDate: string,
): Promise<{
  updatedCommitments: Task[];
  continuityEvents: Array<{
    parent_task_id: string;
    child_task_id: string;
    event_type: ContinuityEventType;
    confidence: 'high' | 'medium' | 'low';
    evidence: Record<string, unknown>;
    source_quote_original: string;
    source_quote_followup: string;
    meeting_original_id: string;
    meeting_followup_id: string;
  }>;
  originalTasksUpdated: Array<{
    task_id: string;
    event_type: ContinuityEventType;
  }>;
}> {
  const supabase = createServerClient();
  const updatedCommitments: Task[] = [...newCommitments];
  const continuityEvents: Array<{
    parent_task_id: string;
    child_task_id: string;
    event_type: ContinuityEventType;
    confidence: 'high' | 'medium' | 'low';
    evidence: Record<string, unknown>;
    source_quote_original: string;
    source_quote_followup: string;
    meeting_original_id: string;
    meeting_followup_id: string;
  }> = [];
  const originalTasksUpdated: Array<{
    task_id: string;
    event_type: ContinuityEventType;
  }> = [];

  // Get all previous commitments by this user that are open/in_progress/blocked
  const { data: previousTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .neq('meeting_id', meetingId)
    .in('status', ['open', 'in_progress', 'blocked', 'overdue'])
    .is('parent_commitment_id', null) // Only link to original commitments, not already-linked ones
    .order('created_at', { ascending: false })
    .limit(100); // Reasonable limit for performance

  if (error) {
    console.error('Error fetching previous commitments:', error);
    return { updatedCommitments, continuityEvents, originalTasksUpdated };
  }

  if (!previousTasks || previousTasks.length === 0) {
    // No previous commitments to link with
    return { updatedCommitments, continuityEvents, originalTasksUpdated };
  }

  // Try to link each new commitment
  for (let i = 0; i < updatedCommitments.length; i++) {
    const newTask = updatedCommitments[i];

    // Find best matching previous commitment
    const match = findBestPreviousCommitment(
      newTask,
      previousTasks as Task[],
      newMeetingDate,
    );

    if (!match) {
      // No match found, this is a new commitment
      continue;
    }

    // Match found - link the commitment and UPDATE the original
    const originalTask = match.task;
    const eventType = detectEventType(originalTask, newTask);

    // Update the new task with parent reference
    updatedCommitments[i] = {
      ...newTask,
      parent_commitment_id: originalTask.id,
      continuity_status: eventType === 'completed' ? 'completed' : 'continued',
      continuity_confidence: match.confidence,
    };

    // NOW: Update the original task based on the event type
    const originalUpdateData: Partial<Task> = {};
    
    if (eventType === 'completed') {
      // If the follow-up says it's complete, mark original as completed
      originalUpdateData.status = 'completed';
    } else if (eventType === 'blocked') {
      // If the follow-up says it's blocked, mark original as blocked
      originalUpdateData.status = 'blocked';
      // Preserve the blocker information from the new task
      if (newTask.blocker) {
        originalUpdateData.blocker = newTask.blocker;
      }
    } else if (eventType === 'rescheduled') {
      // If the follow-up provides a new due date, update it
      if (newTask.due_date && newTask.due_date !== originalTask.due_date) {
        originalUpdateData.due_date = newTask.due_date;
      }
    } else if (eventType === 'progress') {
      // If the follow-up indicates progress, update status to in_progress
      if (originalTask.status === 'open') {
        originalUpdateData.status = 'in_progress';
      }
    }

    // Update the original task in the database if there are changes
    if (Object.keys(originalUpdateData).length > 0) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          ...originalUpdateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', originalTask.id);

      if (updateError) {
        console.error(
          `Failed to update original commitment ${originalTask.id}:`,
          updateError,
        );
      } else {
        console.log(
          `[CONTINUITY] Updated original commitment ${originalTask.id} - event_type: ${eventType}`,
        );
        originalTasksUpdated.push({
          task_id: originalTask.id,
          event_type: eventType,
        });
      }
    }

    // Create continuity event record
    continuityEvents.push({
      parent_task_id: originalTask.id,
      child_task_id: newTask.id,
      event_type: eventType,
      confidence: match.confidence,
      evidence: match.evidence as unknown as Record<string, unknown>,
      source_quote_original: originalTask.source_quote,
      source_quote_followup: newTask.source_quote,
      meeting_original_id: originalTask.meeting_id,
      meeting_followup_id: meetingId,
    });

    console.log(
      `[CONTINUITY] Linked commitment: "${newTask.description}" to original "${originalTask.description}" (${match.confidence} confidence) - event: ${eventType}`,
    );
  }

  return { updatedCommitments, continuityEvents, originalTasksUpdated };
}

/**
 * Save continuity events to database
 */
export async function saveContinuityEvents(
  events: Array<{
    parent_task_id: string;
    child_task_id: string;
    event_type: string;
    confidence: string;
    evidence: Record<string, any>;
    source_quote_original: string;
    source_quote_followup: string;
    meeting_original_id: string;
    meeting_followup_id: string;
  }>,
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('commitment_continuity_events')
    .insert(events);

  if (error) {
    console.error('Error saving continuity events:', error);
    throw new Error(`Failed to save continuity events: ${error.message}`);
  }
}
