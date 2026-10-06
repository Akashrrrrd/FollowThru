import { NextResponse, NextRequest } from 'next/server';
import { getUserFromRequest, createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { ensureUserInDefaultTeam } from '@/lib/team-migration';
import { getUserTeamContext } from '@/lib/team-context';
import { sanitizeProfileInput } from '@/lib/profile-validation';
import { profileUpdateLimiter, getClientIp, makeRateLimitKey } from '@/lib/rate-limiter';

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
      },
    );

    const {
      data: { user: authUser },
    } = await userClient.auth.getUser();

    const userEmail = authUser?.email || 'unknown@example.com';
    const userCreatedAt = authUser?.created_at || new Date().toISOString();

    // Get user profile (Phase 3)
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    // FALLBACK: if the profile doesn't exist yet (e.g. the user signed up while email
    // confirmation was required, so no session existed to call POST /api/profile),
    // create it from the data collected in the sign-up wizard (stored in user metadata).
    if (!profile && !profileError) {
      const signupProfile = authUser?.user_metadata?.signup_profile;
      if (signupProfile) {
        const parsed = sanitizeProfileInput(signupProfile, false);
        if (parsed.ok) {
          const { data: created, error: createError } = await supabase
            .from('user_profiles')
            .upsert({ id: user.userId, ...parsed.values }, { onConflict: 'id' })
            .select()
            .single();
          if (createError) {
            console.error('Profile auto-create error:', createError);
          } else {
            profile = created;
          }
        } else {
          console.warn('Signup profile metadata invalid:', parsed.error);
        }
      }
    }

    // Get all tasks for the user
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select(
        `
        *,
        meetings!inner(user_id, title, created_at)
      `,
      )
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
    const isDone = (s: string) => s === 'done' || s === 'completed';
    const totalTasks = allTasks?.length || 0;
    const doneTasks = allTasks?.filter((t) => isDone(t.status)).length || 0;
    const overdueTasks =
      allTasks?.filter((t) => {
        if (isDone(t.status) || !t.due_date) return false;
        return new Date(t.due_date) < new Date();
      }).length || 0;
    const openTasks =
      allTasks?.filter(
        (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'blocked',
      ).length || 0;

    const efficiency = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const myTasks = allTasks?.filter((t) => t.owner_user_id === user.userId) || [];
    const myDoneTasks = myTasks.filter((t) => isDone(t.status)).length;
    const myEfficiency = myTasks.length > 0 ? Math.round((myDoneTasks / myTasks.length) * 100) : 0;

    const recentMeetings =
      meetings?.slice(0, 5).map((m) => {
        const meetingTasks = allTasks?.filter((t) => t.meeting_id === m.id) || [];
        const done = meetingTasks.filter((t) => isDone(t.status)).length;
        return {
          id: m.id,
          title: m.title,
          created_at: m.created_at,
          total_tasks: meetingTasks.length,
          done_tasks: done,
        };
      }) || [];

    const upcomingTasks =
      allTasks
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
      teamContext = await getUserTeamContext(
        supabase,
        user.userId,
        orgContext.organizationId,
      ).catch((err) => {
        console.warn('Failed to get team context:', err);
        return null;
      });
    }

    return NextResponse.json({
      profile: profile || null,
      user: {
        email: userEmail,
        id: user.userId,
        created_at: userCreatedAt,
      },
      organization: orgContext
        ? {
            id: orgContext.organizationId,
            role: orgContext.role,
          }
        : null,
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
    return NextResponse.json({ error: 'Failed to fetch profile data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting: prevent spam profile updates
  const clientIp = getClientIp(request);
  const rateLimitKey = makeRateLimitKey(clientIp, 'profile/post');
  const rateLimitCheck = profileUpdateLimiter.check(rateLimitKey);

  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many profile update requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitCheck.retryAfter || 60),
        },
      }
    );
  }

  const supabase = createServerClient();

  try {
    const body = await request.json().catch(() => null);
    const parsed = sanitizeProfileInput(body, false);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert({ id: user.userId, ...parsed.values }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Profile upsert error:', error);
      return NextResponse.json(
        { error: `Failed to save profile. ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile });
  } catch (err) {
    console.error('Profile POST error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting: prevent spam profile updates
  const clientIp = getClientIp(request);
  const rateLimitKey = makeRateLimitKey(clientIp, 'profile/patch');
  const rateLimitCheck = profileUpdateLimiter.check(rateLimitKey);

  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many profile update requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitCheck.retryAfter || 60),
        },
      }
    );
  }

  const supabase = createServerClient();

  try {
    const body = await request.json().catch(() => null);
    const parsed = sanitizeProfileInput(body, true);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updates = parsed.values;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json(
        { error: `Failed to update profile. ${error.message}` },
        { status: 500 },
      );
    }

    if (updated) {
      return NextResponse.json({ profile: updated });
    }

    // No profile row yet: create one (requires full_name)
    const full = sanitizeProfileInput(updates, false);
    if (!full.ok) {
      return NextResponse.json({ error: full.error }, { status: 400 });
    }
    const { data: created, error: createError } = await supabase
      .from('user_profiles')
      .upsert({ id: user.userId, ...full.values }, { onConflict: 'id' })
      .select()
      .single();

    if (createError) {
      console.error('Profile create-on-patch error:', createError);
      return NextResponse.json(
        { error: `Failed to save profile. ${createError.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ profile: created });
  } catch (err) {
    console.error('Profile PATCH error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}