import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/pending-assignment
 *
 * Fetch tasks that need assignment review (ambiguous owner/team/lead).
 * Returns tasks where needs_assignment_review=true for this user's organization.
 *
 * Returns:
 * - 200: List of tasks with ambiguity data
 * - 401: Not authenticated
 * - 403: No organization membership
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get user's organization
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership.' },
        { status: 403 },
      );
    }

    // Fetch tasks pending assignment review in this organization
    // Include meeting title for context
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(
        `
        id,
        description,
        owner,
        source_quote,
        assigned_to_user_id,
        team_id,
        team_lead_id,
        needs_assignment_review,
        assignment_ambiguity_data,
        meetings!inner(id, title),
        created_at
      `,
      )
      .eq('organization_id', orgContext.organizationId)
      .eq('needs_assignment_review', true)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('[pending-assignment] Query error:', tasksError);
      return NextResponse.json({ error: 'Database error.' }, { status: 500 });
    }

    // Transform response to include meeting title
    const formatted = (tasks || []).map((task) => ({
      id: task.id,
      description: task.description,
      owner: task.owner,
      source_quote: task.source_quote,
      assigned_to_user_id: task.assigned_to_user_id,
      team_id: task.team_id,
      team_lead_id: task.team_lead_id,
      needs_assignment_review: task.needs_assignment_review,
      assignment_ambiguity_data: task.assignment_ambiguity_data,
      meeting_title: (Array.isArray(task.meetings) && task.meetings.length > 0 ? task.meetings[0]?.title : null) || 'Unknown Meeting',
      meeting_id: Array.isArray(task.meetings) && task.meetings.length > 0 ? task.meetings[0]?.id : null,
      created_at: task.created_at,
    }));

    console.log(`[pending-assignment] Found ${formatted.length} tasks for user ${user.userId}`);

    return NextResponse.json({
      tasks: formatted,
      count: formatted.length,
    });
  } catch (err) {
    console.error('[pending-assignment] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
