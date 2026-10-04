import { NextRequest, NextResponse } from 'next/server';

import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeams } from '@/lib/team-authorization';
import { updateOverdueTasks } from '@/lib/overdue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  try {

    const user = await getUserFromRequest(req);

    if (!user) {

      return NextResponse.json(

        { error: 'You must be signed in.' },

        { status: 401 },

      );

    }

    const supabase = createServerClient();
    
    // Phase 1: Get user's organization context
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    // Phase 2: Get user's teams
    const userTeams = await getUserTeams(supabase, user.userId, orgContext.organizationId);
    const teamIds = userTeams.map((t) => t.teamId);

    await updateOverdueTasks(user.userId);

    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');

    const owner = searchParams.get('owner');

    const meetingId = searchParams.get('meeting_id');

    const myCommitments = searchParams.get('my_commitments') === 'true';

    let query = supabase

      .from('tasks')

      .select('*')

      .eq('organization_id', orgContext.organizationId);
    
    // Phase 2: Filter to tasks created by user or assigned to user or in user's teams
    if (teamIds.length > 0) {
      query = query.or(
        `user_id.eq.${user.userId},assigned_to_user_id.eq.${user.userId},team_id.in.(${teamIds.join(',')})`
      );
    } else {
      // If not in any teams, only show own tasks
      query = query.or(`user_id.eq.${user.userId},assigned_to_user_id.eq.${user.userId}`);
    }

      query = query.order('due_date', { ascending: true, nullsFirst: false });

    if (status && status !== 'all') {

      query = query.eq('status', status);

    }

    if (owner && owner !== 'all') {

      query = query.eq('owner', owner);

    }

    if (meetingId) {

      query = query.eq('meeting_id', meetingId);

    }

    // Filter to only tasks owned by current user (owner_user_id === user.userId)

    if (myCommitments) {

      query = query.eq('owner_user_id', user.userId);

    }

    const { data: tasks, error } = await query;

    if (error) {

      return NextResponse.json(

        { error: 'Failed to fetch tasks.' },

        { status: 500 },

      );

    }

    return NextResponse.json({ tasks: tasks ?? [] });

  } catch (err) {

    console.error('Tasks GET error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}

export async function POST(req: NextRequest) {

  try {

    const user = await getUserFromRequest(req);

    if (!user) {

      return NextResponse.json(

        { error: 'You must be signed in.' },

        { status: 401 },

      );

    }

    const body = await req.json();

    const { meeting_id, description, owner, due_date } = body as {

      meeting_id?: string;

      description?: string;

      owner?: string;

      due_date?: string | null;

    };

    if (!meeting_id || !description || !description.trim() || !owner || !owner.trim()) {

      return NextResponse.json(

        { error: 'Meeting ID, description, and owner are required.' },

        { status: 400 },

      );

    }

    const supabase = createServerClient();

    // Get user's organization (required for org-scoped data)
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    // Verify the meeting belongs to this user AND their organization
    const { data: meeting, error: meetingError } = await supabase

      .from('meetings')

      .select('id, organization_id')

      .eq('id', meeting_id)

      .eq('user_id', user.userId)
      .eq('organization_id', orgContext.organizationId)

      .maybeSingle();

    if (meetingError || !meeting) {

      return NextResponse.json(

        { error: 'Meeting not found.' },

        { status: 404 },

      );

    }

    const { data: task, error } = await supabase

      .from('tasks')

      .insert({

        meeting_id,

        user_id: user.userId,
        organization_id: orgContext.organizationId,

        description: description.trim(),

        owner: owner.trim(),

        due_date: due_date || null,

        source_quote: 'Manually added',

      })

      .select()

      .single();

    if (error || !task) {

      return NextResponse.json(

        { error: 'Failed to create task.' },

        { status: 500 },

      );

    }

    return NextResponse.json({ task });

  } catch (err) {

    console.error('Task POST error:', err);

    return NextResponse.json(

      { error: 'An unexpected error occurred.' },

      { status: 500 },

    );

  }

}
