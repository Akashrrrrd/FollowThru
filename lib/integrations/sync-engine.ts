import { createClient } from '@supabase/supabase-js';

export class SyncEngine {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Start sync job
   */
  async startSync(userId: string, provider: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        provider,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(
    jobId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    itemsSynced?: number,
    error?: string,
  ): Promise<void> {
    const update: any = {
      status,
      completed_at: ['completed', 'failed'].includes(status) ? new Date() : null,
    };

    if (itemsSynced !== undefined) update.items_synced = itemsSynced;
    if (error) update.error_message = error;

    await this.supabase.from('sync_jobs').update(update).eq('id', jobId);
  }

  /**
   * Get sync history
   */
  async getSyncHistory(userId: string, limit: number = 10): Promise<any[]> {
    const { data } = await this.supabase
      .from('sync_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Sync task from external provider
   */
  async syncTaskFromProvider(
    userId: string,
    provider: string,
    externalTaskId: string,
    taskData: any,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        user_id: userId,
        description: taskData.title || taskData.name,
        owner: taskData.assignee || 'Unassigned',
        due_date: taskData.dueDate,
        status: taskData.status || 'open',
        meeting_id: null,
        source: `${provider}:${externalTaskId}`,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }
}
