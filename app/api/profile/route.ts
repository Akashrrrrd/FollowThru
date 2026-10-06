import { NextResponse, NextRequest } from 'next/server';
import { getUserFromRequest, createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { ensureUserInDefaultTeam } from '@/lib/team-migration';
import { getUserTeamContext } from '@/lib/team-context';
import { sanitizeProfileInput } from '@/lib/profile-validation';
import { profileUpdateLimiter, getClientIp, makeRateLimitKey } from '@/lib/rate-limiter';
import { successResponse, createdResponse, unauthorized, internalError, validationError, rateLimitExceeded } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized('You must be signed in');
  }

  const supabase = createServerClient();

  try {
    // Ensure user is in default team
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (orgContext) {
      await ensureUserInDefaultTeam(supabase, user.userId, orgContext.organizationId).catch(
        (err) => console.warn('Failed to ensure user in default team:', err),
      );
    }

    // Get user metadata
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${user.token}` } },
        auth: { persistSession: false },
      },
    );

    const { data: { user: authUser } } = await userClient.auth.getUser();
    const userEmail = authUser?.email || 'unknown@example.com';
    const userCreatedAt = authUser?.created_at || new Date().toISOString();

    // Get user profile
    let { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.userId)
      .maybeSingle();

    if (profileError) console.error('Profile fetch error:', profileError);

    // Auto-create profile from signup metadata if missing
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
          if (!createError) profile = created;
          else console.error('Profile auto-create error:', createError);
        }
      }
    }

    // Get all tasks
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*, meetings!inner(user_id, title, created_at)')
      .eq('user_id', user.userId);

    if (tasksError) throw tasksError;

    // Get all meetings
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false });

    if (meetingsError) throw meetingsError;

    // Calculate stats
    const isDone = (s: string) => s === 'done' || s === 'completed';
    const totalTasks = allTasks?.length || 0;
    const doneTasks = allTasks?.filter((t) => isDone(t.status)).length || 0;
    const overdueTasks = allTasks?.filter((t) => {
      if (isDone(t.status) || !t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length || 0;
    const openTasks = allTasks?.filter(
      (t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'blocked',
    ).length || 0;

    const efficiency = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const myTasks = allTasks?.filter((t) => t.owner_user_id === user.userId) || [];
    const myDoneTasks = myTasks.filter((t) => isDone(t.status)).length;
    const myEfficiency = myTasks.length > 0 ? Math.round((myDoneTasks / myTasks.length) * 100) : 0;

    const recentMeetings = meetings?.slice(0, 5).map((m) => {
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

    // Get team context
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

    return successResponse({
      profile: profile || null,
      user: {
        email: userEmail,
        id: user.userId,
        created_at: userCreatedAt,
      },
      organization: orgContext
        ? { id: orgContext.organizationId, role: orgContext.role }
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
    return internalError('Failed to fetch profile data');
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized('You must be signed in');
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = makeRateLimitKey(clientIp, 'profile/post');
  const rateLimitCheck = profileUpdateLimiter.check(rateLimitKey);

  if (!rateLimitCheck.allowed) {
    return rateLimitExceeded('Too many profile update requests');
  }

  const supabase = createServerClient();

  try {
    const body = await request.json().catch(() => null);
    const parsed = sanitizeProfileInput(body, false);
    if (!parsed.ok) {
      return validationError(parsed.error);
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert({ id: user.userId, ...parsed.values }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Profile upsert error:', error);
      return internalError(`Failed to save profile. ${error.message}`);
    }

    return createdResponse(profile, 'Profile created successfully');
  } catch (err) {
    console.error('Profile POST error:', err);
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized('You must be signed in');
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = makeRateLimitKey(clientIp, 'profile/patch');
  const rateLimitCheck = profileUpdateLimiter.check(rateLimitKey);

  if (!rateLimitCheck.allowed) {
    return rateLimitExceeded('Too many profile update requests');
  }

  const supabase = createServerClient();

  try {
    const body = await request.json().catch(() => null);
    const parsed = sanitizeProfileInput(body, true);
    if (!parsed.ok) {
      return validationError(parsed.error);
    }

    const updates = parsed.values;
    if (Object.keys(updates).length === 0) {
      return validationError('No fields to update');
    }

    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Profile update error:', error);
      return internalError(`Failed to update profile. ${error.message}`);
    }

    if (updated) {
      return successResponse(updated, { message: 'Profile updated successfully' });
    }

    // No profile row yet: create one
    const full = sanitizeProfileInput(updates, false);
    if (!full.ok) {
      return validationError(full.error);
    }

    const { data: created, error: createError } = await supabase
      .from('user_profiles')
      .upsert({ id: user.userId, ...full.values }, { onConflict: 'id' })
      .select()
      .single();

    if (createError) {
      console.error('Profile create-on-patch error:', createError);
      return internalError(`Failed to save profile. ${createError.message}`);
    }

    return createdResponse(created, 'Profile created successfully');
  } catch (err) {
    console.error('Profile PATCH error:', err);
    return internalError('An unexpected error occurred');
  }
}
