/**
 * GET  /api/teams/invitations/accept?token=...  - invitation details (public, token-gated)
 * POST /api/teams/invitations/accept            - accept invitation (auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { TeamInvitationService } from '@/lib/team-invitation-service';
import { removeUnusedPersonalOrganizations } from '@/lib/personal-org-cleanup';
import { invitationAcceptLimiter, getClientIp, makeRateLimitKey } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: prevent brute-force token guessing
    const clientIp = getClientIp(request);
    const rateLimitKey = makeRateLimitKey(clientIp, 'invitations/accept');
    const rateLimitCheck = invitationAcceptLimiter.check(rateLimitKey);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many invitation acceptance attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitCheck.retryAfter || 60),
          },
        }
      );
    }

    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const invitationService = new TeamInvitationService(supabase);

    // Look up the signed-in user's email so we can verify it matches the invite.
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.userId);

    if (authError || !authUser?.user) {
      console.error('[invitations/accept] Failed to resolve accepting user:', authError);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // Invitation emails are stored lower-cased, so compare lower-cased
    const userEmail = authUser.user.email?.trim().toLowerCase() ?? null;

    await invitationService.acceptInvitation(token, user.userId, userEmail);

    // Best effort: drop the user's empty auto-created personal organization so the
    // organization they just joined becomes their only one. Never fails the request.
    const removed = await removeUnusedPersonalOrganizations(supabase, user.userId);
    if (removed.length > 0) {
      console.log(`[invitations/accept] Removed ${removed.length} unused personal organization membership(s) for ${user.userId}`);
    }

    return NextResponse.json({ message: 'Invitation accepted successfully' }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[invitations/accept] Error:', errorMessage);

    if (errorMessage.includes('Invalid or expired')) {
      return NextResponse.json({ error: 'Invitation is invalid or has expired' }, { status: 400 });
    }

    if (errorMessage.includes('email mismatch')) {
      return NextResponse.json(
        {
          error:
            'This invitation was sent to a different email address. Please sign in with the invited email.',
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const invitationService = new TeamInvitationService(supabase);

    const details = await invitationService.getInvitationWithDetails(token);

    if (!details) {
      return NextResponse.json({ error: 'Invitation is invalid or has expired' }, { status: 404 });
    }

    return NextResponse.json(
      {
        email: details.invitation.email,
        team: {
          id: details.team?.id,
          name: details.team?.name,
        },
        inviterName:
          details.inviterProfile?.display_name || details.inviterProfile?.full_name || 'A team member',
        expiresAt: details.invitation.token_expires_at,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error getting invitation details:', err);
    return NextResponse.json({ error: 'Failed to get invitation details' }, { status: 500 });
  }
}