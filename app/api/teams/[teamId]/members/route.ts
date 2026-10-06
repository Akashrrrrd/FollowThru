/**
 * GET  /api/teams/[teamId]/members - List team members (+ pending invitations for managers)
 * POST /api/teams/[teamId]/members - Add member to team or invite by email (managers/team leads only)
 *
 * The organization is resolved from the TEAM itself (see getTeamAccess), so users who belong
 * to several organizations can still see the members of teams they belong to.
 */

import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getTeamAccess } from '@/lib/team-access';
import { getTeamMembersWithIdentity } from '@/lib/team-context';
import { TeamInvitationService } from '@/lib/team-invitation-service';
import {
  generateTeamInvitationEmailHtml,
  generateTeamInvitationEmailText,
} from '@/lib/email-templates/team-invitation';
import { EmailProvider } from '@/lib/email-provider';
import { AddTeamMemberSchema, validateRequest } from '@/lib/validation-schemas';
import {
  unauthorized,
  notFound,
  insufficientPermissions,
  validationError,
  conflict,
  internalError,
  createdResponse,
  successResponse,
} from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type Supabase = ReturnType<typeof createServerClient>;

/** Find an auth user by (lower-cased) email, paging through all users. */
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
      return unauthorized();
    }

    const supabase = createServerClient();

    // Team must exist and the user must belong to the team's organization.
    const access = await getTeamAccess(supabase, user.userId, params.teamId);
    if (!access) {
      return notFound('Team not found');
    }

    // Use optimized batch fetch instead of Promise.all + N+1 calls
    const membersWithIdentity = await getTeamMembersWithIdentity(supabase, params.teamId);

    const formattedMembers = membersWithIdentity.map((member) => ({
      id: member.id,
      team_id: member.team_id,
      user_id: member.user_id,
      role: member.role,
      created_at: member.created_at,
      user: member.user,
    }));

    // Pending invitations are only visible to people who can manage the team.
    let invitations: unknown[] = [];
    if (access.canManage) {
      try {
        invitations = await new TeamInvitationService(supabase).getPendingInvitationsForTeam(
          params.teamId,
        );
      } catch (err) {
        console.warn('Failed to load pending invitations:', err);
      }
    }

    return successResponse({
      members: formattedMembers,
      invitations,
      // Permissions for the CURRENT user, computed server-side. The UI uses these
      // to show/hide edit controls (the API still enforces them on every write).
      can_manage: access.canManage,
      org_role: access.orgRole,
      team_role: access.teamRole,
    });
  } catch (err) {
    console.error('Team members GET error:', err);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } },
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return unauthorized();
    }

    const supabase = createServerClient();

    const access = await getTeamAccess(supabase, user.userId, params.teamId);
    if (!access) {
      return notFound('Team not found');
    }
    if (!access.canManage) {
      return insufficientPermissions('team');
    }

    const body = await request.json().catch(() => null);

    // Validate request body
    const validation = validateRequest(AddTeamMemberSchema, body);
    if (!validation.valid) {
      return validationError(validation.error);
    }

    // Resolve the target: an existing user (by id or email) or a new email to invite.
    let targetUserId: string | undefined = validation.data.userId;
    let normalizedEmail: string | null = validation.data.email ?? null;

    if (!targetUserId && normalizedEmail) {
      try {
        const foundUser = await findAuthUserByEmail(supabase, normalizedEmail);
        if (foundUser) targetUserId = foundUser.id;
      } catch (err) {
        console.error('Failed to lookup user:', err);
        return internalError('Failed to lookup user');
      }
    }

    // ---- Existing user: is she already in the team's organization? ----
    let isOrgMember = false;

    if (targetUserId) {
      const { data: orgMember, error: orgError } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('organization_id', access.organizationId)
        .maybeSingle();

      if (orgError) {
        console.error('Failed to verify organization membership:', orgError);
        return internalError('Failed to verify user organization membership');
      }

      isOrgMember = !!orgMember;

      if (!isOrgMember && !normalizedEmail) {
        return validationError('User is not a member of this organization');
      }
    }

    // In the organization already: add straight to the team.
    // (An account that is NOT in the org falls through to the invitation flow;
    // accepting the invitation adds them to the org.)
    if (targetUserId && isOrgMember) {
      const { data: member, error } = await supabase
        .from('team_members')
        .insert({ team_id: params.teamId, user_id: targetUserId, role: validation.data.role })
        .select('id, team_id, user_id, role, created_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return conflict('User is already a member of this team');
        }
        console.error('Failed to add team member:', error);
        return internalError('Failed to add team member');
      }

      // Fetch full user details for response
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, full_name')
        .eq('id', targetUserId)
        .maybeSingle();

      return createdResponse(
        {
          ...member,
          user: {
            id: targetUserId,
            email: userProfile?.email ?? null,
            display_name: userProfile?.display_name ?? null,
            full_name: userProfile?.full_name ?? null,
          },
        },
        'Member added to team'
      );
    }

    // ---- New email: create an invitation and send the email ----
    if (!normalizedEmail) {
      return validationError('Invalid request');
    }

    const invitationService = new TeamInvitationService(supabase);

    if (await invitationService.hasPendingInvitation(normalizedEmail, params.teamId)) {
      return conflict('Invitation already sent to this email');
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
          .eq('id', access.organizationId)
          .maybeSingle(),
      ]);

    const invitation = await invitationService.createInvitation({
      teamId: params.teamId,
      organizationId: access.organizationId,
      email: normalizedEmail,
      role: validation.data.role,
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
      return createdResponse(
        {
          invitation: invitationSummary,
          warning:
            'Invitation created but the email could not be delivered. Please try again or contact an administrator.',
        }
      );
    }

    return createdResponse(
      {
        invitation: invitationSummary,
        message: `Invitation sent to ${normalizedEmail}`,
      }
    );
  } catch (err) {
    console.error('Team members POST error:', err);
    return internalError();
  }
}
