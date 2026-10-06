import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizations } from '@/lib/organization-context';
import { updateOverdueTasks } from '@/lib/overdue';
import { successResponse, createdResponse, unauthorized, internalError, validationError, notFound } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks
 *
 * Returns tasks (within organizations the user belongs to) that the user created,
 * is assigned to, or that belong to a team the user is a member of.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();

    // All organizations user belongs to
    const orgs = await getUserOrganizations(supabase, user.userId);
    if (orgs.length === 0) {
      return validationError('User has no organization membership');
    }
    const orgIds = orgs.map((o) => o.organizationId);

    // User's teams
    const { data: memberships, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.userId);

    if (membershipError) {
      console.error('Tasks GET: failed to load team memberships:', membershipError);
    }
    const teamIds = (memberships ?? []).map((m: any) => m.team_id as string);

    await updateOverdueTasks(user.userId);

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const owner = searchParams.get('owner');
    const meetingId = searchParams.get('meeting_id');
    const myCommitments = searchParams.get('my_commitments') === 'true';

    const visibility = [
      `user_id.eq.${user.userId}`,
      `assigned_to_user_id.eq.${user.userId}`,
    ];
    if (teamIds.length > 0) {
      visibility.push(`team_id.in.(${teamIds.join(',')})`);
    }

    let query = supabase
      .from('tasks')
      .select('*')
      .in('organization_id', orgIds)
      .or(visibility.join(','))
      .order('due_date', { ascending: true, nullsFirst: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (owner && owner !== 'all') query = query.eq('owner', owner);
    if (meetingId) query = query.eq('meeting_id', meetingId);
    if (myCommitments) query = query.eq('owner_user_id', user.userId);

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Tasks GET error:', error);
      return internalError('Failed to fetch tasks');
    }

    return successResponse(tasks ?? []);
  } catch (err) {
    console.error('Tasks GET error:', err);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/tasks
 *
 * Manually add a task to one of the user's meetings.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const body = await req.json().catch(() => null);
    const { meeting_id, description, owner, due_date } = (body ?? {}) as {
      meeting_id?: string;
      description?: string;
      owner?: string;
      due_date?: string | null;
    };

    // Validation
    if (!meeting_id || typeof meeting_id !== 'string') {
      return validationError('Meeting ID is required', { field: 'meeting_id' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return validationError('Description is required', { field: 'description' });
    }
    if (!owner || typeof owner !== 'string' || !owner.trim()) {
      return validationError('Owner is required', { field: 'owner' });
    }
    if (description.trim().length > 1000) {
      return validationError('Description must be at most 1000 characters', { field: 'description' });
    }
    if (owner.trim().length > 200) {
      return validationError('Owner must be at most 200 characters', { field: 'owner' });
    }
    if (due_date && isNaN(new Date(due_date).getTime())) {
      return validationError('Due date is not a valid date', { field: 'due_date' });
    }

    const supabase = createServerClient();

    // Verify meeting belongs to user
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meeting_id)
      .eq('user_id', user.userId)
      .maybeSingle();

    if (meetingError || !meeting) {
      return notFound('Meeting not found');
    }

    if (!meeting.organization_id) {
      return internalError('Meeting has no organization');
    }

    // Verify user belongs to meeting's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.userId)
      .eq('organization_id', meeting.organization_id)
      .maybeSingle();

    if (orgError || !orgMember) {
      return notFound('Meeting not found');
    }

    // Create task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        meeting_id,
        user_id: user.userId,
        organization_id: meeting.organization_id,
        team_id: meeting.team_id ?? null,
        description: description.trim(),
        owner: owner.trim(),
        due_date: due_date || null,
        source_quote: 'Manually added',
      })
      .select()
      .single();

    if (error || !task) {
      console.error('Task POST error:', error);
      return internalError('Failed to create task');
    }

    return createdResponse(task, 'Task created successfully');
  } catch (err) {
    console.error('Task POST error:', err);
    return internalError('An unexpected error occurred');
  }
}
