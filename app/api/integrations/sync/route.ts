import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Cron job that runs every 15 minutes to sync connected integrations
 * Triggered by external cron service (Vercel Cron, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const secret = request.headers.get('authorization');
    if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get all active integrations
    const { data: integrations, error: fetchError } = await supabase
      .from('integration_clients')
      .select('id, user_id, provider, access_token, last_synced')
      .not('access_token', 'is', null);

    if (fetchError) throw fetchError;

    const results = [];

    for (const integration of integrations || []) {
      try {
        if (integration.provider === 'jira') {
          await syncJira(supabase, integration.user_id, integration.access_token);
        } else if (integration.provider === 'asana') {
          await syncAsana(supabase, integration.user_id, integration.access_token);
        } else if (integration.provider === 'monday') {
          await syncMonday(supabase, integration.user_id, integration.access_token);
        } else if (integration.provider === 'clickup') {
          await syncClickUp(supabase, integration.user_id, integration.access_token);
        }

        // Update last_synced timestamp
        await supabase
          .from('integration_clients')
          .update({ last_synced: new Date() })
          .eq('id', integration.id);

        results.push({ provider: integration.provider, status: 'success' });
      } catch (err) {
        console.error(`Sync ${integration.provider} error:`, err);
        results.push({
          provider: integration.provider,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ synced: results.length, results });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}

async function syncJira(supabase: any, userId: string, accessToken: string) {
  // Fetch issues from Jira
  const res = await fetch('https://api.atlassian.com/rest/api/3/issues/search', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Jira API error');

  const data = await res.json();

  // Sync each issue as a task
  for (const issue of data.issues || []) {
    const source = `jira:${issue.key}`;

    // Check if already exists
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('source', source)
      .single();

    if (!existing) {
      // Create new task
      await supabase.from('tasks').insert({
        user_id: userId,
        description: issue.fields.summary,
        owner: issue.fields.assignee?.displayName || 'Unassigned',
        due_date: issue.fields.duedate,
        status: mapJiraStatus(issue.fields.status.name),
        source,
      });
    } else {
      // Update existing task
      await supabase
        .from('tasks')
        .update({
          description: issue.fields.summary,
          owner: issue.fields.assignee?.displayName || 'Unassigned',
          due_date: issue.fields.duedate,
          status: mapJiraStatus(issue.fields.status.name),
        })
        .eq('id', existing.id);
    }
  }
}

async function syncAsana(supabase: any, userId: string, accessToken: string) {
  const res = await fetch('https://app.asana.com/api/1.0/tasks?assignee=me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Asana API error');

  const data = await res.json();

  for (const task of data.data || []) {
    const source = `asana:${task.gid}`;

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('source', source)
      .single();

    if (!existing) {
      await supabase.from('tasks').insert({
        user_id: userId,
        description: task.name,
        owner: task.assignee?.name || 'Unassigned',
        due_date: task.due_on,
        status: task.completed ? 'completed' : 'open',
        source,
      });
    } else {
      await supabase
        .from('tasks')
        .update({
          description: task.name,
          owner: task.assignee?.name || 'Unassigned',
          due_date: task.due_on,
          status: task.completed ? 'completed' : 'open',
        })
        .eq('id', existing.id);
    }
  }
}

async function syncMonday(supabase: any, userId: string, accessToken: string) {
  // Monday.com uses GraphQL
  const res = await fetch('https://api.monday.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        me {
          boards {
            items {
              id
              name
              state
              due_date
              owner {
                name
              }
            }
          }
        }
      }`,
    }),
  });

  if (!res.ok) throw new Error('Monday API error');
  // Implementation similar to above
}

async function syncClickUp(supabase: any, userId: string, accessToken: string) {
  const res = await fetch('https://api.clickup.com/api/v2/task?archived=false', {
    headers: { Authorization: accessToken },
  });

  if (!res.ok) throw new Error('ClickUp API error');

  const data = await res.json();

  for (const task of data.tasks || []) {
    const source = `clickup:${task.id}`;

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('source', source)
      .single();

    if (!existing) {
      await supabase.from('tasks').insert({
        user_id: userId,
        description: task.name,
        owner: task.assignees[0]?.username || 'Unassigned',
        due_date: task.due_date ? new Date(parseInt(task.due_date)).toISOString() : null,
        status: task.status.status.toLowerCase(),
        source,
      });
    }
  }
}

function mapJiraStatus(jiraStatus: string): string {
  const mapping: Record<string, string> = {
    'To Do': 'open',
    'In Progress': 'in_progress',
    'Done': 'completed',
    'Blocked': 'blocked',
  };
  return mapping[jiraStatus] || 'open';
}
