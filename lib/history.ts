import { createServerClient } from './supabase-server';
import type { HistoryChangeType } from './types';

/**
 * Add a history entry for a task change.
 * Lightweight utility for tracking status and field changes.
 * 
 * @param taskId - The task ID
 * @param userId - The user ID
 * @param changeType - Type of change (e.g., 'status_changed', 'date_changed')
 * @param oldValue - Previous value (optional)
 * @param newValue - New value (optional)
 * @param notes - Additional notes (optional)
 */
export async function addHistoryEntry(
  taskId: string,
  userId: string,
  changeType: HistoryChangeType,
  oldValue?: string | null,
  newValue?: string | null,
  notes?: string | null,
): Promise<void> {
  try {
    const supabase = createServerClient();

    const { error } = await supabase.from('commitment_history').insert({
      task_id: taskId,
      user_id: userId,
      change_type: changeType,
      old_value: oldValue || null,
      new_value: newValue || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to add history entry:', error.message);
    }
  } catch (err) {
    console.error('History entry error:', err);
  }
}
