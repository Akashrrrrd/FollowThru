import { NextResponse, NextRequest } from 'next/server';
import { getUserFromRequest, createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { ensureUserInDefaultTeam } from '@/lib/team-migration';
import { getUserTeamContext } from '@/lib/team-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    // Phase 2: Ensure user is in default team for their organization
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (orgContext) {
      await ensureUserInDefaultTeam(supabase, user.userId, orgContext.organizationId).catch(
        (err) => {
          console.warn('Failed to ensure user in default team:', err);
          // Non-blocking: don't fail profile fetch if team assignment fails
        },
      );
    }

    // Get user metadata using the user's token
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${user.token}` } },
        auth: { persistSession: false },
      }
    );
    
    const { data: { user: authUser } } = await userClient.auth.getUser();
    
    const userEmail = authUser?.email || 'unknown@example.com';
    const userCreatedAt = authUser?.created_at || new Date().toISOString();
    
    // Get user profile (Phase 3)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }
    
    // Get all tasks for the user
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        *,
        meetings!inner(user_id, title, created_at)
      `)
      .eq('user_id', user.userId);

    if (tasksError) throw tasksError;

    // Get all meetings for the user
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });

    if (meetingsError) throw meetingsError;

    // Calculate statistics
    const totalTasks = allTasks?.length || 0;
    const doneTasks = allTasks?.filter((t) => t.status === 'done' || t.status === 'completed').length || 0;
    const overdueTasks = allTasks?.filter((t) => {
      if (t.status === 'done' || t.status === 'completed' || !t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length || 0;
    const openTasks = allTasks?.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'blocked').length || 0;

    // Calculate efficiency (completion rate)
    const efficiency = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Get tasks assigned to the user (by owner_user_id)
    const myTasks = allTasks?.filter((t) => 
      t.owner_user_id === user.userId
    ) || [];

    const myDoneTasks = myTasks.filter((t) => t.status === 'done' || t.status === 'completed').length;
    const myEfficiency = myTasks.length > 0 ? Math.round((myDoneTasks / myTasks.length) * 100) : 0;

    // Get recent meetings (last 5)
    const recentMeetings = meetings?.slice(0, 5).map((m) => {
      const meetingTasks = allTasks?.filter((t) => t.meeting_id === m.id) || [];
      const done = meetingTasks.filter((t) => t.status === 'done' || t.status === 'completed').length;
      return {
        id: m.id,
        title: m.title,
        created_at: m.created_at,
        total_tasks: meetingTasks.length,
        done_tasks: done,
      };
    }) || [];

    // Get upcoming tasks (open tasks with due dates)
    const upcomingTasks = allTasks
      ?.filter((t) => t.status === 'open' && t.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        description: t.description,
        owner: t.owner,
        due_date: t.due_date,
        meeting_id: t.meeting_id,
      })) || [];

    // Phase 2: Get team context for user
    let teamContext = null;
    if (orgContext) {
      teamContext = await getUserTeamContext(supabase, user.userId, orgContext.organizationId).catch(
        (err) => {
          console.warn('Failed to get team context:', err);
          return null;
        },
      );
    }

    return NextResponse.json({
      profile: profile || null,
      user: {
        email: userEmail,
        id: user.userId,
        created_at: userCreatedAt,
      },
      organization: orgContext ? {
        id: orgContext.organizationId,
        role: orgContext.role,
      } : null,
      teams: teamContext || null,
      stats: {
        totalTasks,
        doneTasks,
        openTasks,
        overdueTasks,
        efficiency,
        myTasks: myTasks.length,
        myDoneTasks,
        myEfficiency,
        totalMeetings: meetings?.length || 0,
      },
      recentMeetings,
      upcomingTasks,
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch profile data' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { 
      full_name, 
      display_name, 
      job_title, 
      avatar_url,
      // New professional fields
      phone,
      email,
      company,
      bio,
      location,
    } = body as {
      full_name?: string;
      display_name?: string;
      job_title?: string | null;
      avatar_url?: string | null;
      phone?: string | null;
      email?: string | null;
      company?: string | null;
      bio?: string | null;
      location?: string | null;
    };

    if (!full_name || !full_name.trim()) {
      return NextResponse.json(
        { error: 'Full name is required.' },
        { status: 400 },
      );
    }

    const displayName = display_name?.trim() || full_name.trim().split(' ')[0];

    // Upsert user profile (insert or update)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.userId,
          full_name: full_name.trim(),
          display_name: displayName,
          job_title: job_title || null,
          avatar_url: avatar_url || null,
          phone: phone || null,
          email: email || null,
          company: company || null,
          bio: bio || null,
          location: location || null,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Profile upsert error:', error);
      return NextResponse.json(
        { error: 'Failed to save profile.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('Profile POST error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  try {
    const body = await request.json();
    const { 
      full_name, 
      display_name, 
      job_title, 
      avatar_url,
      // New professional fields
      phone,
      email,
      company,
      bio,
      location,
    } = body as {
      full_name?: string;
      display_name?: string;
      job_title?: string | null;
      avatar_url?: string | null;
      phone?: string | null;
      email?: string | null;
      company?: string | null;
      bio?: string | null;
      location?: string | null;
    };

    // Build updates object (only include provided fields)
    const updates: Record<string, any> = {};
    if (full_name !== undefined) updates.full_name = full_name.trim() || '';
    if (display_name !== undefined) updates.display_name = display_name.trim() || '';
    if (job_title !== undefined) updates.job_title = job_title || null;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
    if (phone !== undefined) updates.phone = phone || null;
    if (email !== undefined) updates.email = email || null;
    if (company !== undefined) updates.company = company || null;
    if (bio !== undefined) updates.bio = bio || null;
    if (location !== undefined) updates.location = location || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update.' },
        { status: 400 },
      );
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.userId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json(
        { error: 'Failed to update profile.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('Profile PATCH error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
