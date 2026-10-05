import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizations } from '@/lib/organization-context';
import { updateOverdueTasks } from '@/lib/overdue';

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
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    const supabase = createServerClient();

    // All of the user's organizations (users can belong to more than one)
    const orgs = await getUserOrganizations(supabase, user.userId);
    if (orgs.length === 0) {
      return NextResponse.json({ error: 'User has no organization membership' }, { status: 403 });
    }
    const orgIds = orgs.map((o) => o.organizationId);

    // The user's teams: a single query (no per-team lookups)
    const { data: memberships, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.userId);

    if (membershipError) {
      console.error('Tasks GET: failed to load team memberships:', membershipError);
    }
    const teamIds = (memberships ?? []).map((m: any) => m.team_id as string);

    await updateOverdueTasks(user.userId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const owner = searchParams.get('owner');
    const meetingId = searchParams.get('meeting_id');
    const myCommitments = searchParams.get('my_commitments') === 'true';

    const visibility = [`user_id.eq.${user.userId}`, `assigned_to_user_id.eq.${user.userId}`];
    if (teamIds.length > 0) {
      visibility.push(`team_id.in.(${teamIds.join(',')})`);
    }

    let query = supabase
      .from('tasks')
      .select('*')
      .in('organization_id', orgIds) // never leaves the user's own organizations
      .or(visibility.join(','))
      .order('due_date', { ascending: true, nullsFirst: false });

    if (status && status !== 'all') query = query.eq('status', status);
    if (owner && owner !== 'all') query = query.eq('owner', owner);
    if (meetingId) query = query.eq('meeting_id', meetingId);
    if (myCommitments) query = query.eq('owner_user_id', user.userId);

    const { data: tasks, error } = await query;

    if (error) {
      console.error('Tasks GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks.' }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (err) {
    console.error('Tasks GET error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * POST /api/tasks
 *
 * Manually add a task to one of the user's meetings. The organization (and team) come from
 * the MEETING, so this works for users who belong to several organizations.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const { meeting_id, description, owner, due_date } = (body ?? {}) as {
      meeting_id?: string;
      description?: string;
      owner?: string;
      due_date?: string | null;
    };

    if (
      typeof meeting_id !== 'string' ||
      typeof description !== 'string' ||
      typeof owner !== 'string' ||
      !description.trim() ||
      !owner.trim()
    ) {
      return NextResponse.json(
        { error: 'Meeting ID, description, and owner are required.' },
        { status: 400 },
      );
    }
    if (description.trim().length > 1000) {
      return NextResponse.json({ error: 'Description must be at most 1000 characters.' }, { status: 400 });
    }
    if (owner.trim().length > 200) {
      return NextResponse.json({ error: 'Owner must be at most 200 characters.' }, { status: 400 });
    }
    if (due_date && isNaN(new Date(due_date).getTime())) {
      return NextResponse.json({ error: 'Due date is not a valid date.' }, { status: 400 });
    }

    const supabase = createServerClient();

    // The meeting must belong to this user
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meeting_id)
      .eq('user_id', user.userId)
      .maybeSingle();

    if (meetingError || !meeting || !meeting.organization_id) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    // ...and the user must (still) belong to the meeting's organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.userId)
      .eq('organization_id', meeting.organization_id)
      .maybeSingle();

    if (orgError || !orgMember) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        meeting_id,
        user_id: user.userId,
        organization_id: meeting.organization_id,
        team_id: meeting.team_id ?? null, // inherit the meeting's team so team views can see it
        description: description.trim(),
        owner: owner.trim(),
        due_date: due_date || null,
        source_quote: 'Manually added',
      })
      .select()
      .single();

    if (error || !task) {
      console.error('Task POST error:', error);
      return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error('Task POST error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}