/**
 * GET  /api/teams/invitations/accept?token=...  - invitation details (public)
 * POST /api/teams/invitations/accept            - accept invitation (auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  getUserFromRequest,
} from '@/lib/supabase-server';
import { TeamInvitationService } from '@/lib/team-invitation-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = (await request.json()) as { token?: string };

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const invitationService = new TeamInvitationService(supabase);

    // Look up the signed-in user's email so we can verify it matches the invite.
    const { data: authUser, error: authError } =
      await supabase.auth.admin.getUserById(user.userId);

    if (authError || !authUser?.user) {
      console.error('Failed to resolve accepting user:', authError);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    await invitationService.acceptInvitation(
      token,
      user.userId,
      authUser.user.email ?? null,
    );

    return NextResponse.json(
      { message: 'Invitation accepted successfully' },
      { status: 200 },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    if (errorMessage.includes('Invalid or expired')) {
      return NextResponse.json(
        { error: 'Invitation is invalid or has expired' },
        { status: 400 },
      );
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

    console.error('Error accepting invitation:', err);

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const invitationService = new TeamInvitationService(supabase);

    const details = await invitationService.getInvitationWithDetails(token);

    if (!details) {
      return NextResponse.json(
        { error: 'Invitation is invalid or has expired' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        email: details.invitation.email,
        team: {
          id: details.team?.id,
          name: details.team?.name,
        },
        inviterName:
          details.inviterProfile?.display_name ||
          details.inviterProfile?.full_name ||
          'A team member',
        expiresAt: details.invitation.token_expires_at,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error getting invitation details:', err);

    return NextResponse.json(
      { error: 'Failed to get invitation details' },
      { status: 500 },
    );
  }
}