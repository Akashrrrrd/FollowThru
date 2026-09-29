import { createServerClient } from './supabase-server';

/**
 * Marks any incomplete tasks whose due_date has passed as 'overdue' in the database.
 * Run this before returning task lists to ensure statuses are current.
 * 
 * Marks tasks as overdue if:
 * - due_date is in the past (before today)
 * - status is open, in_progress, or blocked (not completed or done)
 */
export async function updateOverdueTasks(userId?: string) {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // Build the query to find tasks that should be marked overdue
  let query = supabase
    .from('tasks')
    .update({ status: 'overdue' })
    .lt('due_date', today)
    .in('status', ['open', 'in_progress', 'blocked']);  // Only mark incomplete tasks as overdue

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;

  if (error) {
    console.error('Failed to update overdue tasks:', error.message);
  }
}
