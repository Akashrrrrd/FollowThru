/**
 * GET  /api/teams/[teamId]/members - List team members (+ pending invitations for managers)
 * POST /api/teams/[teamId]/members - Add member to team or invite by email (managers/team leads only)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  getUserFromRequest,
} from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import {
  canManageTeam,
  teamBelongsToOrganization,
} from '@/lib/team-authorization';
import { TeamInvitationService } from '@/lib/team-invitation-service';
import {
  generateTeamInvitationEmailHtml,
  generateTeamInvitationEmailText,
} from '@/lib/email-templates/team-invitation';
import { EmailProvider } from '@/lib/email-provider';

export const dynamic = 'force-dynamic';

type Supabase = ReturnType<typeof createServerClient>;

async function resolveIdentity(supabase: Supabase, userId: string) {
  let email: string | null = null;
  let displayName: string | null = null;
  let fullName: string | null = null;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('display_name, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn(`Failed to fetch profile for ${userId}:`, profileError);
  }
  if (profile) {
    displayName = profile.display_name || null;
    fullName = profile.full_name || null;
  }

  try {
    const { data: authUser, error: authError } =
      await supabase.auth.admin.getUserById(userId);
    if (authError) {
      console.warn(`Failed to fetch auth user ${userId}:`, authError);
    } else if (authUser?.user) {
      email = authUser.user.email ?? null;
    }
  } catch (err) {
    console.warn(`Failed to resolve auth user ${userId}:`, err);
  }

  return { id: userId, email, display_name: displayName, full_name: fullName };
}

/**
 * Find an auth user by email, paging through all users.
 * (The old code only looked at the first 1000 users.)
 */
async function findAuthUserByEmail(supabase: Supabase, email: string) {
  const perPage = 1000;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) break;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 403 });
    }

    const teamValid = await teamBelongsToOrganization(
      supabase,
      params.teamId,
      orgContext.organizationId,
    );
    if (!teamValid) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, team_id, user_id, role, created_at')
      .eq('team_id', params.teamId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Failed to fetch team members:', membersError);
      return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 });
    }

    const formattedMembers = await Promise.all(
      (members ?? []).map(async (member) => ({
        id: member.id,
        team_id: member.team_id,
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        user: await resolveIdentity(supabase, member.user_id),
      })),
    );

    // Pending invitations are only shown to people who can manage the team.
    let invitations: unknown[] = [];
    const canManage = await canManageTeam(
      supabase,
      user.userId,
      params.teamId,
      orgContext.organizationId,
    );
    if (canManage) {
      try {
        invitations = await new TeamInvitationService(supabase).getPendingInvitationsForTeam(
          params.teamId,
        );
      } catch (err) {
        console.warn('Failed to load pending invitations:', err);
      }
    }

    return NextResponse.json({ members: formattedMembers, invitations });
  } catch (err) {
    console.error('Team members GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 403 });
    }

    const teamValid = await teamBelongsToOrganization(
      supabase,
      params.teamId,
      orgContext.organizationId,
    );
    if (!teamValid) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const canManage = await canManageTeam(
      supabase,
      user.userId,
      params.teamId,
      orgContext.organizationId,
    );
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to manage this team' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { email, userId: providedUserId, role } = body as {
      email?: string;
      userId?: string;
      role?: string;
    };

    if (!role || !['team_lead', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Resolve the target: either an existing user (by id or by email) or a
    // brand-new email that needs an invitation.
    let targetUserId: string | undefined =
      typeof providedUserId === 'string' ? providedUserId : undefined;
    let normalizedEmail: string | null = null;

    if (!targetUserId) {
      if (!email || typeof email !== 'string' || !email.trim()) {
        return NextResponse.json({ error: 'email or userId is required' }, { status: 400 });
      }

      normalizedEmail = email.trim().toLowerCase();

      let foundUser;
      try {
        foundUser = await findAuthUserByEmail(supabase, normalizedEmail);
      } catch (err) {
        console.error('Failed to lookup user:', err);
        return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 });
      }

      if (foundUser) targetUserId = foundUser.id;
    }

    // ---- Existing user: check organization membership ----
    let isOrgMember = false;

    if (targetUserId) {
      const { data: orgMember, error: orgError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('organization_id', orgContext.organizationId)
        .maybeSingle();

      if (orgError) {
        console.error('Failed to verify organization membership:', orgError);
        return NextResponse.json(
          { error: 'Failed to verify user organization membership' },
          { status: 500 },
        );
      }

      isOrgMember = !!orgMember;

      // A raw userId that is outside the org can't be invited (no email).
      if (!isOrgMember && !normalizedEmail) {
        return NextResponse.json(
          { error: 'User is not a member of this organization' },
          { status: 400 },
        );
      }
    }

    // Already in the organization: add straight to the team.
    // (An existing account that is NOT in the org falls through to the
    // invitation flow below; accepting the invite adds them to the org.)
    if (targetUserId && isOrgMember) {
      const { data: member, error } = await supabase
        .from('team_members')
        .insert({ team_id: params.teamId, user_id: targetUserId, role })
        .select('id, team_id, user_id, role, created_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'User is already a member of this team' },
            { status: 400 },
          );
        }
        console.error('Failed to add team member:', error);
        return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
      }

      return NextResponse.json(
        {
          ...member,
          user: await resolveIdentity(supabase, targetUserId),
          message: 'Member added to team',
        },
        { status: 201 },
      );
    }

    // ---- New email: create an invitation and send the email ----
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const invitationService = new TeamInvitationService(supabase);

    if (await invitationService.hasPendingInvitation(normalizedEmail, params.teamId)) {
      return NextResponse.json(
        { error: 'Invitation already sent to this email' },
        { status: 400 },
      );
    }

    const [{ data: teamData }, { data: inviterProfile }, { data: orgData }] =
      await Promise.all([
        supabase.from('teams').select('name').eq('id', params.teamId).maybeSingle(),
        supabase
          .from('user_profiles')
          .select('display_name, full_name')
          .eq('id', user.userId)
          .maybeSingle(),
        supabase
          .from('organizations')
          .select('name')
          .eq('id', orgContext.organizationId)
          .maybeSingle(),
      ]);

    const invitation = await invitationService.createInvitation({
      teamId: params.teamId,
      organizationId: orgContext.organizationId,
      email: normalizedEmail,
      role: role as 'team_lead' | 'member',
      invitedBy: user.userId,
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin ||
      'https://followthruai.vercel.app';
    const acceptanceUrl = invitationService.getAcceptanceUrl(invitation.token, baseUrl);

    const emailParams = {
      recipientEmail: normalizedEmail,
      inviterName:
        inviterProfile?.display_name || inviterProfile?.full_name || 'A team member',
      teamName: teamData?.name || 'a team',
      organizationName: orgData?.name || 'the organization',
      acceptanceUrl,
      expiresAt: new Date(invitation.token_expires_at),
    };

    const invitationSummary = {
      id: invitation.id,
      email: invitation.email,
      status: 'pending' as const,
      role: invitation.role,
    };

    try {
      await EmailProvider.getInstance().send({
        to: normalizedEmail,
        subject: `Join ${emailParams.teamName} on FollowThru`,
        html: generateTeamInvitationEmailHtml(emailParams),
        text: generateTeamInvitationEmailText(emailParams),
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      return NextResponse.json(
        {
          invitation: invitationSummary,
          warning:
            'Invitation created but the email could not be delivered. Please try again or contact an administrator.',
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        invitation: invitationSummary,
        message: `Invitation sent to ${normalizedEmail}`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Team members POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}