import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeamContext } from '@/lib/team-context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/drill-down?task_id=...
 *
 * Get detailed task information with full provenance and source meeting context.
 *
 * Authorization:
 * - User must be authenticated
 * - User can view: their own tasks, their team's tasks (if team lead), org tasks (if manager/owner)
 *
 * Query Parameters:
 * - task_id (required): Task ID to fetch details for
 *
 * Returns:
 * - 200: Detailed task information with provenance
 * - 400: Missing required parameters
 * - 401: Not authenticated
 * - 403: Not authorized to view this task
 * - 404: Task not found
 * - 500: Server error
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('task_id');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing required parameter: commitment_id' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Get organization and team context (server-validated)
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    const teamContext = await getUserTeamContext(supabase, user.userId, orgContext.organizationId);

    // Fetch task with all related data
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(
        `
        id,
        description,
        owner,
        status,
        due_date,
        source_quote,
        created_at,
        updated_at,
        assigned_to_user_id,
        team_id,
        team_lead_id,
        needs_assignment_review,
        assignment_ambiguity_data,
        organization_id,
        meeting_id,
        continuity_status,
        continuity_confidence,
        parent_commitment_id,
        commitment_type,
        dependency,
        confidence,
        meetings!inner(
          id,
          title,
          created_at,
          transcript,
          user_id
        ),
        user_profiles!assigned_to_user_id(
          id,
          display_name,
          full_name,
          job_title
        ),
        teams!inner(id, name)
      `,
      )
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('[task-drill-down] Query error:', taskError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Commitment not found' }, { status: 404 });
    }

    // Authorization check
    const taskMeetings = task.meetings as Array<{ id: string; title: string; created_at: string; transcript: string; user_id: string }>;
    const isOwner = taskMeetings && taskMeetings.length > 0 && taskMeetings[0].user_id === user.userId;
    const isAssignee = task.assigned_to_user_id === user.userId;
    const isOrgManager = orgContext.role === 'owner' || orgContext.role === 'manager';
    const isTeamLead = teamContext?.teams?.some(
      (t: any) => t.teamId === task.team_id && t.role === 'team_lead',
    );

    if (!isOwner && !isAssignee && !isOrgManager && !isTeamLead) {
      return NextResponse.json(
        { error: 'Not authorized to view this commitment' },
        { status: 403 },
      );
    }

    // Verify org boundaries
    if (task.organization_id !== orgContext.organizationId) {
      return NextResponse.json(
        { error: 'Commitment does not belong to your organization' },
        { status: 403 },
      );
    }

    // Build response with provenance
    const assignedUser = Array.isArray(task.user_profiles) && task.user_profiles.length > 0 ? task.user_profiles[0] : null;
    const team = Array.isArray(task.teams) && task.teams.length > 0 ? task.teams[0] : null;

    const response = {
      id: task.id,
      description: task.description,
      owner: task.owner,
      status: task.status,
      due_date: task.due_date,
      source_quote: task.source_quote,
      created_at: task.created_at,
      updated_at: task.updated_at,
      assignment: {
        assigned_to_user_id: task.assigned_to_user_id,
        assigned_to: assignedUser
          ? {
              id: assignedUser.id,
              display_name: assignedUser.display_name,
              full_name: assignedUser.full_name,
              job_title: assignedUser.job_title,
            }
          : null,
        team_id: task.team_id,
        team_name: team?.name,
        team_lead_id: task.team_lead_id,
        needs_assignment_review: task.needs_assignment_review,
        assignment_ambiguity_data: task.assignment_ambiguity_data,
      },
      metadata: {
        commitment_type: task.commitment_type,
        confidence: task.confidence,
        dependency: task.dependency,
        continuity_status: task.continuity_status,
        continuity_confidence: task.continuity_confidence,
        parent_commitment_id: task.parent_commitment_id,
      },
      source_meeting: {
        id: taskMeetings[0].id,
        title: taskMeetings[0].title,
        created_at: taskMeetings[0].created_at,
        transcript_preview: taskMeetings[0].transcript
          ? taskMeetings[0].transcript.substring(0, 500) + '...'
          : null,
        source_quote: task.source_quote,
      },
    };

    console.log(`[task-drill-down] Fetched task ${taskId} for user ${user.userId}`);

    return NextResponse.json(response);
  } catch (err) {
    console.error('[task-drill-down] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
