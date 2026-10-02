/**
 * Bidirectional sync service
 * Syncs FollowThru commitments back to Jira, Asana, Monday, ClickUp
 * Handles token refresh and conflict resolution
 */

interface IntegrationCredentials {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  clientId?: string;
  clientSecret?: string;
}

export class BidirectionalSyncService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Refresh OAuth token if expired
   */
  async refreshTokenIfNeeded(
    integrationId: string,
    provider: string,
    credentials: IntegrationCredentials,
  ): Promise<string> {
    // Check if token is expired
    if (!credentials.expiresAt || new Date() < credentials.expiresAt) {
      return credentials.accessToken; // Token still valid
    }

    // Token expired, refresh it
    if (!credentials.refreshToken) {
      throw new Error(`No refresh token available for ${provider}`);
    }

    try {
      let newAccessToken: string;
      let newExpiresAt: Date;

      if (provider === 'jira') {
        const result = await this.refreshJiraToken(credentials.refreshToken);
        newAccessToken = result.accessToken;
        newExpiresAt = new Date(Date.now() + result.expiresIn * 1000);
      } else if (provider === 'asana') {
        const result = await this.refreshAsanaToken(credentials.refreshToken, credentials.clientId, credentials.clientSecret);
        newAccessToken = result.accessToken;
        newExpiresAt = new Date(Date.now() + result.expiresIn * 1000);
      } else if (provider === 'monday') {
        const result = await this.refreshMondayToken(credentials.refreshToken, credentials.clientId, credentials.clientSecret);
        newAccessToken = result.accessToken;
        newExpiresAt = new Date(Date.now() + result.expiresIn * 1000);
      } else if (provider === 'clickup') {
        // ClickUp tokens don't expire, return current token
        return credentials.accessToken;
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // Update stored token
      await this.supabase
        .from('integration_clients')
        .update({
          access_token: newAccessToken,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('id', integrationId);

      return newAccessToken;
    } catch (err) {
      console.error(`Token refresh failed for ${provider}:`, err);
      throw new Error(`Failed to refresh ${provider} token: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  /**
   * Sync FollowThru task changes back to external platform
   */
  async syncTaskToProvider(
    userId: string,
    provider: string,
    task: any,
  ): Promise<void> {
    // Get integration credentials
    const { data: integration } = await this.supabase
      .from('integration_clients')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (!integration || !integration.access_token) {
      console.log(`No ${provider} integration found for user ${userId}`);
      return;
    }

    // Refresh token if needed
    const accessToken = await this.refreshTokenIfNeeded(integration.id, provider, {
      provider,
      accessToken: integration.access_token,
      refreshToken: integration.refresh_token,
      expiresAt: integration.expires_at ? new Date(integration.expires_at) : undefined,
      clientId: integration.client_id,
      clientSecret: integration.client_secret,
    });

    // Extract external task ID from source field
    const [, externalTaskId] = task.source?.split(':') || [];
    if (!externalTaskId) return; // Not an external task

    try {
      if (provider === 'jira') {
        await this.updateJiraIssue(accessToken, externalTaskId, task);
      } else if (provider === 'asana') {
        await this.updateAsanaTask(accessToken, externalTaskId, task);
      } else if (provider === 'monday') {
        await this.updateMondayTask(accessToken, externalTaskId, task);
      } else if (provider === 'clickup') {
        await this.updateClickUpTask(accessToken, externalTaskId, task);
      }
    } catch (err) {
      console.error(`Error syncing task to ${provider}:`, err);
      // Don't throw, just log - we don't want sync failures to break the main flow
    }
  }

  /**
   * Handle conflict resolution
   * If task has been modified both in FollowThru and external platform,
   * apply last-write-wins strategy with audit trail
   */
  async resolveConflict(
    taskId: string,
    provider: string,
    followthruVersion: any,
    externalVersion: any,
  ): Promise<'followthru' | 'external'> {
    // Last-write-wins: compare timestamps
    const followthruTime = new Date(followthruVersion.updated_at || followthruVersion.created_at);
    const externalTime = new Date(externalVersion.updated_at || externalVersion.created_at);

    if (followthruTime > externalTime) {
      // FollowThru version is newer, use it
      return 'followthru';
    } else if (externalTime > followthruTime) {
      // External version is newer, use it
      return 'external';
    } else {
      // Same time, prefer followthru (arbitrary but consistent)
      return 'followthru';
    }
  }

  /**
   * Record sync conflict for audit trail
   */
  async recordSyncConflict(
    taskId: string,
    provider: string,
    followthruVersion: any,
    externalVersion: any,
    resolution: 'followthru' | 'external',
  ): Promise<void> {
    // Optional: implement conflict history table for audit
    console.log(
      `[SYNC CONFLICT] Task ${taskId} on ${provider}: resolved with ${resolution} version`,
    );
  }

  // --- Private token refresh methods ---

  private async refreshJiraToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
      }),
    });

    if (!response.ok) throw new Error('Jira token refresh failed');

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  private async refreshAsanaToken(
    refreshToken: string,
    clientId?: string,
    clientSecret?: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch('https://app.asana.com/-/oauth_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId || process.env.ASANA_CLIENT_ID || '',
        client_secret: clientSecret || process.env.ASANA_CLIENT_SECRET || '',
      }).toString(),
    });

    if (!response.ok) throw new Error('Asana token refresh failed');

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  private async refreshMondayToken(
    refreshToken: string,
    clientId?: string,
    clientSecret?: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await fetch('https://auth.monday.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId || process.env.MONDAY_CLIENT_ID,
        client_secret: clientSecret || process.env.MONDAY_CLIENT_SECRET,
      }),
    });

    if (!response.ok) throw new Error('Monday token refresh failed');

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  // --- Private update methods ---

  private async updateJiraIssue(accessToken: string, issueKey: string, task: any): Promise<void> {
    const fields: Record<string, any> = {};

    if (task.description) fields.summary = task.description;
    if (task.due_date) fields.duedate = new Date(task.due_date).toISOString().split('T')[0];

    const statusMap: Record<string, string> = {
      open: 'To Do',
      in_progress: 'In Progress',
      blocked: 'Blocked',
      completed: 'Done',
    };

    if (task.status && statusMap[task.status]) {
      fields.status = { name: statusMap[task.status] };
    }

    await fetch(`https://api.atlassian.com/rest/api/3/issues/${issueKey}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
  }

  private async updateAsanaTask(accessToken: string, taskGid: string, task: any): Promise<void> {
    const data: Record<string, any> = {};

    if (task.description) data.name = task.description;
    if (task.due_date) data.due_on = new Date(task.due_date).toISOString().split('T')[0];
    if (task.status === 'completed') data.completed = true;
    if (task.status !== 'completed') data.completed = false;

    await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  }

  private async updateMondayTask(accessToken: string, taskId: string, task: any): Promise<void> {
    // Monday.com update via GraphQL
    const mutation = `
      mutation {
        update_item_value(item_id: ${taskId}, column_id: "name", value: "${task.description?.replace(/"/g, '\\"')}") {
          id
        }
      }
    `;

    await fetch('https://api.monday.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation }),
    });
  }

  private async updateClickUpTask(accessToken: string, taskId: string, task: any): Promise<void> {
    const data: Record<string, any> = {};

    if (task.description) data.name = task.description;
    if (task.due_date) data.due_date = new Date(task.due_date).getTime();

    const statusMap: Record<string, string> = {
      open: 'to do',
      in_progress: 'in progress',
      blocked: 'blocked',
      completed: 'complete',
    };

    if (task.status && statusMap[task.status]) {
      data.status = statusMap[task.status];
    }

    await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  }
}
