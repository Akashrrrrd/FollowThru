import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeamContext } from '@/lib/team-context';
import { resolveOwnerToUser } from '@/lib/owner-resolution';
import { resolveUserToTeam } from '@/lib/team-resolution';
import { getTeamLeadResolution } from '@/lib/team-lead-resolution';
import { addHistoryEntry } from '@/lib/history';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/tasks/[id]/assign-owner
 *
 * Resolve ambiguous task assignment based on human review/confirmation.
 * Called when extraction pipeline flags a task with needs_assignment_review=true.
 *
 * Request body:
 * {
 *   assigned_to_user_id?: string,  // Confirm owner if ambiguous
 *   team_id?: string,              // Confirm team if ambiguous
 *   team_lead_id?: string,         // Confirm team lead if ambiguous
 *   reason?: string                // Why this assignment was chosen
 * }
 *
 * Returns:
 * - 200: Task updated successfully with confirmed assignments
 * - 400: Invalid input or conflicting team membership
 * - 401: Not authenticated
 * - 403: User doesn't own task's meeting or not manager
 * - 404: Task not found or not in needs_assignment_review state
 * - 500: Server error
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    const { id: taskId } = params;
    const body = await req.json();

    const {
      assigned_to_user_id,
      team_id,
      team_lead_id,
      reason,
    } = body as {
      assigned_to_user_id?: string;
      team_id?: string;
      team_lead_id?: string;
      reason?: string;
    };

    // Validate at least one assignment is being confirmed
    if (!assigned_to_user_id && !team_id && !team_lead_id) {
      return NextResponse.json(
        { error: 'Must provide at least one: assigned_to_user_id, team_id, or team_lead_id.' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // Get user's org context (for validation)
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership.' },
        { status: 403 },
      );
    }

    // Get user's team context (for permission check)
    const teamContext = await getUserTeamContext(supabase, user.userId, orgContext.organizationId);

    // Fetch task to verify: exists, owned by user, needs review
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(
        `
        id,
        description,
        owner,
        assigned_to_user_id,
        team_id,
        team_lead_id,
        needs_assignment_review,
        assignment_ambiguity_data,
        organization_id,
        meetings!inner(id, user_id)
      `,
      )
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error('[assign-owner] Query error:', taskError);
      return NextResponse.json({ error: 'Database error.' }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    // Permission check: user must own the meeting OR be org manager
    const taskMeetings = task.meetings as Array<{ id: string; user_id: string }>;
    if (!taskMeetings || taskMeetings.length === 0) {
      return NextResponse.json({ error: 'Task meeting not found.' }, { status: 404 });
    }

    const isOwner = taskMeetings[0].user_id === user.userId;
    const isManager = orgContext.role === 'manager' || orgContext.role === 'owner';

    if (!isOwner && !isManager) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this task.' },
        { status: 403 },
      );
    }

    // Task must be flagged for review
    if (!task.needs_assignment_review) {
      return NextResponse.json(
        { error: 'This task is not flagged for assignment review.' },
        { status: 400 },
      );
    }

    const updatePayload: Record<string, any> = {};
    const reasonLog: string[] = [];

    // Step 1: Validate and confirm owner assignment
    if (assigned_to_user_id) {
      // Verify the chosen user exists in the org
      const { data: chosenUser, error: userError } = await supabase
        .from('user_profiles')
        .select('id, display_name, full_name')
        .eq('id', assigned_to_user_id)
        .maybeSingle();

      if (userError || !chosenUser) {
        return NextResponse.json(
          { error: `User ${assigned_to_user_id} not found in organization.` },
          { status: 400 },
        );
      }

      updatePayload.assigned_to_user_id = assigned_to_user_id;
      reasonLog.push(
        `Owner confirmed as ${chosenUser.display_name || chosenUser.full_name || assigned_to_user_id}`,
      );
    }

    // Step 2: Validate and confirm team assignment
    if (team_id) {
      // Verify team exists and belongs to org
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name, organization_id')
        .eq('id', team_id)
        .maybeSingle();

      if (teamError || !team) {
        return NextResponse.json({ error: `Team ${team_id} not found.` }, { status: 400 });
      }

      if (team.organization_id !== orgContext.organizationId) {
        return NextResponse.json(
          { error: 'Team does not belong to this organization.' },
          { status: 403 },
        );
      }

      // If we're assigning a user, verify they're in this team
      if (assigned_to_user_id) {
        const { data: membership, error: memberError } = await supabase
          .from('team_members')
          .select('id')
          .eq('user_id', assigned_to_user_id)
          .eq('team_id', team_id)
          .maybeSingle();

        if (memberError || !membership) {
          return NextResponse.json(
            {
              error: `User is not a member of team ${team.name}. Cannot assign.`,
            },
            { status: 400 },
          );
        }
      }

      updatePayload.team_id = team_id;
      reasonLog.push(`Team confirmed as ${team.name}`);
    }

    // Step 3: Validate and confirm team lead assignment
    if (team_lead_id) {
      // Verify team lead user exists
      const { data: leadUser, error: leadError } = await supabase
        .from('user_profiles')
        .select('id, display_name, full_name')
        .eq('id', team_lead_id)
        .maybeSingle();

      if (leadError || !leadUser) {
        return NextResponse.json(
          { error: `Team lead ${team_lead_id} not found.` },
          { status: 400 },
        );
      }

      // If team was specified, verify team lead is in that team
      const confirmTeamId = team_id || task.team_id;
      if (confirmTeamId) {
        const { data: leadMembership, error: leadMemberError } = await supabase
          .from('team_members')
          .select('id, role')
          .eq('user_id', team_lead_id)
          .eq('team_id', confirmTeamId)
          .maybeSingle();

        if (leadMemberError || !leadMembership || leadMembership.role !== 'team_lead') {
          return NextResponse.json(
            {
              error: 'User is not a team lead in the specified team.',
            },
            { status: 400 },
          );
        }
      }

      updatePayload.team_lead_id = team_lead_id;
      reasonLog.push(
        `Team lead confirmed as ${leadUser.display_name || leadUser.full_name || team_lead_id}`,
      );
    }

    // Mark task as no longer needing review
    updatePayload.needs_assignment_review = false;
    updatePayload.assignment_ambiguity_data = null; // Clear ambiguity data

    // Update task
    const { error: updateError } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId);

    if (updateError) {
      console.error('[assign-owner] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
    }

    // Add history entry documenting the manual assignment
    const historyNotes =
      reason ||
      `Assignment confirmed by ${teamContext?.teams?.[0]?.teamName ? 'team' : 'user'}: ${reasonLog.join('; ')}`;

    await addHistoryEntry(taskId, user.userId, 'updated', null, null, historyNotes);

    console.log(
      `[assign-owner] Task ${taskId} assignment confirmed by ${user.userId}: ${historyNotes}`,
    );

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Task assignment confirmed.',
      confirmed: {
        assigned_to_user_id: updatePayload.assigned_to_user_id || task.assigned_to_user_id,
        team_id: updatePayload.team_id || task.team_id,
        team_lead_id: updatePayload.team_lead_id || task.team_lead_id,
      },
    });
  } catch (err) {
    console.error('[assign-owner] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
