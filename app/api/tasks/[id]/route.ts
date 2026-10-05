import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';

import { isValidTransition } from '@/lib/lifecycle';

import { addHistoryEntry } from '@/lib/history';

import { CompletionNotificationService } from '@/lib/completion-notification-service';

import { BidirectionalSyncService } from '@/lib/integrations/bidirectional-sync';

import { handleTaskAssignment, handleStatusChangeNotification, handleDueDateChangeNotification } from '@/lib/notification-service';

import type { TaskStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(

  req: NextRequest,

  { params }: { params: { id: string } },

) {

  try {

    const user = await getUserFromRequest(req);

    if (!user) {

      return NextResponse.json(

        { error: 'You must be signed in.' },

        { status: 401 },

      );

    }

    console.log('[PATCH] Task update for user:', user.userId);

    const { id } = params;

    const body = await req.json();

    const { status, description, owner, due_date, assigned_to_user_id, team_id } = body as {

      status?: string;

      description?: string;

      owner?: string;

      due_date?: string | null;

      assigned_to_user_id?: string | null;

      team_id?: string | null;

    };

    const supabase = createServerClient();

    // Get user's organization context (for org validation)
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    // Verify task ownership and org context
    const { data: existing, error: checkError } = await supabase
      .from('tasks')
      .select('id, status, description, owner, due_date, organization_id, assigned_to_user_id, team_id')
      .eq('id', id)
      .eq('user_id', user.userId)
      .eq('organization_id', orgContext.organizationId)
      .maybeSingle();

    if (checkError || !existing) {
      console.error('[PATCH] Task lookup failed:', { id, userId: user.userId, checkError, found: !!existing });
      
      // Check if task exists with different user_id
      const { data: otherUserTask } = await supabase
        .from('tasks')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();
      
      console.error('[PATCH] Task exists with different user?', otherUserTask?.user_id);
      
      return NextResponse.json(
        { error: 'Commitment not found.' },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = {};
    let statusChangedToCompleted = false;

    if (status !== undefined) {
      const validStatuses: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'done', 'overdue'];
      
      if (!validStatuses.includes(status as TaskStatus)) {
        return NextResponse.json(
          { error: `Status must be one of: ${validStatuses.join(', ')}` },
          { status: 400 },
        );
      }

      // Check if transition is valid
      let currentStatus = existing.status as TaskStatus;
      // Treat 'overdue' as 'open' for validation purposes
      if (currentStatus === 'overdue') {
        currentStatus = 'open';
      }
      
      if (!isValidTransition(currentStatus, status as TaskStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from "${existing.status}" to "${status}".` },
          { status: 400 },
        );
      }

      updates.status = status;
      
      // If transitioning to 'completed', set completed_at timestamp
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        statusChangedToCompleted = true;
      }

      // Log status change to history
      await addHistoryEntry(
        id,
        user.userId,
        'status_changed',
        existing.status,
        status,
      );
    }

    if (description !== undefined) {

      if (!description.trim()) {

        return NextResponse.json(

          { error: 'Description cannot be empty.' },

          { status: 400 },

        );

      }

      updates.description = description.trim();

      // Log description change to history
      await addHistoryEntry(
        id,
        user.userId,
        'updated',
        existing.description || '',
        description.trim(),
        'Description updated',
      );

    }

    if (owner !== undefined) {

      if (!owner.trim()) {

        return NextResponse.json(

          { error: 'Owner cannot be empty.' },

          { status: 400 },

        );

      }

      updates.owner = owner.trim();

    }

    if (due_date !== undefined) {

      updates.due_date = due_date || null;

      // Log date change to history
      await addHistoryEntry(
        id,
        user.userId,
        'date_changed',
        existing.due_date || null,
        due_date || null,
        'Due date updated',
      );

    }

    // Handle task assignment validation
    if (assigned_to_user_id !== undefined) {
      // If assigning to a user, validate they're in the same organization
      if (assigned_to_user_id !== null) {
        // Check if assigned_to_user is in same organization
        const { data: assignedUserOrg, error: assignedUserError } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', assigned_to_user_id)
          .eq('organization_id', orgContext.organizationId)
          .maybeSingle();

        if (assignedUserError || !assignedUserOrg) {
          return NextResponse.json(
            { error: 'Cannot assign commitment to user from different organization.' },
            { status: 400 },
          );
        }

        // If task has a team, validate user is in that team
        const finalTeamId = team_id !== undefined ? team_id : existing.team_id;
        if (finalTeamId) {
          const { data: teamMembership, error: membershipError } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', finalTeamId)
            .eq('user_id', assigned_to_user_id)
            .maybeSingle();

          if (membershipError || !teamMembership) {
            return NextResponse.json(
              { error: 'Cannot assign commitment to user who is not a member of the commitment\'s team.' },
              { status: 400 },
            );
          }
        }
      }
      updates.assigned_to_user_id = assigned_to_user_id;
    }

    // Handle team assignment validation
    if (team_id !== undefined) {
      // If setting a team, validate it exists and belongs to same org
      if (team_id !== null) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('organization_id')
          .eq('id', team_id)
          .eq('organization_id', orgContext.organizationId)
          .maybeSingle();

        if (teamError || !teamData) {
          return NextResponse.json(
            { error: 'Team not found or belongs to different organization.' },
            { status: 400 },
          );
        }

        // If task already has an assigned user, validate they're in the new team
        const finalAssignedUserId = assigned_to_user_id !== undefined ? assigned_to_user_id : existing.assigned_to_user_id;
        if (finalAssignedUserId) {
          const { data: teamMembership, error: membershipError } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', team_id)
            .eq('user_id', finalAssignedUserId)
            .maybeSingle();

          if (membershipError || !teamMembership) {
            return NextResponse.json(
              { error: 'Cannot change team: current assignee is not a member of the new team.' },
              { status: 400 },
            );
          }
        }
      }
      updates.team_id = team_id;
    }

    if (Object.keys(updates).length === 0) {

      return NextResponse.json(

        { error: 'No fields to update.' },

        { status: 400 },

      );

    }

    const { data: task, error } = await supabase

      .from('tasks')

      .update(updates)

      .eq('id', id)

      .eq('user_id', user.userId)

      .select('id, description, status, owner, due_date, meeting_id, created_at, updated_at, completed_at')

      .single();

    if (error || !task) {
      console.error('[PATCH] Update failed:', { error, taskData: task, updates });

      return NextResponse.json(

        { error: 'Failed to update commitment.' },

        { status: 500 },

      );

    }
    
    console.log('[PATCH] Task updated successfully:', { id, status: task.status, updates });

    // Trigger assignment notification if assigned_to_user_id changed
    if (assigned_to_user_id !== undefined && assigned_to_user_id !== existing.assigned_to_user_id) {
      try {
        // Get full task data for notification
        const { data: fullTask } = await supabase
          .from('tasks')
          .select('id, description, owner, due_date, meeting_id, team_id')
          .eq('id', id)
          .single();

        if (fullTask) {
          await handleTaskAssignment(
            supabase,
            id,
            existing.assigned_to_user_id,
            assigned_to_user_id,
            {
              title: task.description || 'Unnamed commitment',
              description: fullTask.description || '',
              owner: task.owner || 'Unassigned',
              dueDate: fullTask.due_date || undefined,
              organizationId: orgContext.organizationId,
              teamId: fullTask.team_id || undefined,
              meetingId: fullTask.meeting_id || undefined,
            },
            // Get user email for notification context (optional)
            undefined // Will be populated if needed in notification service
          );
        }
      } catch (err) {
        console.error('Error handling task assignment notification:', err);
        // Don't fail the task update if notification fails
      }
    }

    // Trigger status change notification if status changed
    if (status !== undefined && status !== existing.status) {
      try {
        const { data: fullTask } = await supabase
          .from('tasks')
          .select('id, description, assigned_to_user_id, owner_user_id')
          .eq('id', id)
          .single();

        if (fullTask) {
          await handleStatusChangeNotification(supabase, {
            taskId: id,
            taskDescription: task.description || 'Unnamed commitment',
            organizationId: orgContext.organizationId,
            teamId: existing.team_id,
            oldStatus: existing.status,
            newStatus: status,
            assignedToUserId: fullTask.assigned_to_user_id,
            ownerUserId: fullTask.owner_user_id || user.userId,
          });
        }
      } catch (err) {
        console.error('Error handling status change notification:', err);
        // Don't fail the task update if notification fails
      }
    }

    // Trigger due date change notification if due_date changed
    if (due_date !== undefined && due_date !== existing.due_date) {
      try {
        const { data: fullTask } = await supabase
          .from('tasks')
          .select('id, description, assigned_to_user_id, owner_user_id')
          .eq('id', id)
          .single();

        if (fullTask) {
          await handleDueDateChangeNotification(supabase, {
            taskId: id,
            taskDescription: task.description || 'Unnamed commitment',
            organizationId: orgContext.organizationId,
            teamId: existing.team_id || undefined,
            oldDueDate: existing.due_date,
            newDueDate: due_date || undefined,
            assignedToUserId: fullTask.assigned_to_user_id,
            ownerUserId: fullTask.owner_user_id || user.userId,
          });
        }
      } catch (err) {
        console.error('Error handling due date change notification:', err);
        // Don't fail the task update if notification fails
      }
    }

    // Auto-create completion notification if status changed to 'completed'
    let completionNotificationId: string | null = null;
    if (statusChangedToCompleted) {
      try {
        const notificationService = new CompletionNotificationService(supabase);
        completionNotificationId = await notificationService.autoCreateCompletionNotification(id, user.userId);
      } catch (err) {
        console.error('Error auto-creating completion notification:', err);
        // Don't fail the task update if notification creation fails
      }
    }

    // Trigger reverse sync if task has external source (e.g., jira:KEY-123)
    // Note: source column doesn't exist in tasks table, so skip this for now
    // if (task.source && Object.keys(updates).length > 0) {
    //   try {
    //     const [provider] = task.source.split(':');
    //     if (provider && ['jira', 'asana', 'monday', 'clickup'].includes(provider)) {
    //       const syncService = new BidirectionalSyncService(supabase);
    //       await syncService.syncTaskToProvider(user.userId, provider, task);
    //     }
    //   } catch (err) {
    //     console.error('Error syncing task to provider:', err);
    //     // Don't fail the task update if sync fails
    //   }
    // }

    return NextResponse.json({ 
      task,
      completionNotificationId: completionNotificationId || undefined,
    });

  } catch (err) {

    console.error('Task PATCH error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
