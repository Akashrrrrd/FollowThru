/**
 * GET /api/teams/[teamId]/members - List team members
 * POST /api/teams/[teamId]/members - Add member to team (managers/team leads only)
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

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } },
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const supabase = createServerClient();

    // Get user's organization
    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId,
    );

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 403 },
      );
    }

    // Verify team belongs to user's organization
    const teamValid = await teamBelongsToOrganization(
      supabase,
      params.teamId,
      orgContext.organizationId,
    );

    if (!teamValid) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 },
      );
    }

    // Get team members
    const {
      data: members,
      error: membersError,
    } = await supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        user_id,
        role,
        created_at
      `)
      .eq('team_id', params.teamId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Failed to fetch team members:', membersError);

      return NextResponse.json(
        { error: 'Failed to load team members' },
        { status: 500 },
      );
    }

    // Resolve user identity for each team member.
    //
    // user_profiles contains display_name/full_name.
    // Supabase Auth contains the user's email.
    const formattedMembers = await Promise.all(
      (members ?? []).map(async (member) => {
        let email: string | null = null;
        let displayName: string | null = null;
        let fullName: string | null = null;

        // Get profile information
        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('user_profiles')
          .select('display_name, full_name')
          .eq('id', member.user_id)
          .maybeSingle();

        if (profileError) {
          console.warn(
            `Failed to fetch profile for ${member.user_id}:`,
            profileError,
          );
        }

        if (profile) {
          displayName = profile.display_name || null;
          fullName = profile.full_name || null;
        }

        // Get email from Supabase Auth
        try {
          const {
            data: authUser,
            error: authError,
          } = await supabase.auth.admin.getUserById(member.user_id);

          if (authError) {
            console.warn(
              `Failed to fetch auth user ${member.user_id}:`,
              authError,
            );
          } else if (authUser?.user) {
            email = authUser.user.email ?? null;
          }
        } catch (authError) {
          console.warn(
            `Failed to resolve auth user ${member.user_id}:`,
            authError,
          );
        }

        return {
          id: member.id,
          team_id: member.team_id,
          user_id: member.user_id,
          role: member.role,
          created_at: member.created_at,

          // Keep the structure expected by the existing frontend.
          user: {
            id: member.user_id,
            email,
            display_name: displayName,
            full_name: fullName,
          },
        };
      }),
    );

    return NextResponse.json({
      members: formattedMembers,
    });
  } catch (err) {
    console.error('Team members GET error:', err);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } },
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const supabase = createServerClient();

    // Get user's organization
    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId,
    );

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 403 },
      );
    }

    // Verify team belongs to user's organization
    const teamValid = await teamBelongsToOrganization(
      supabase,
      params.teamId,
      orgContext.organizationId,
    );

    if (!teamValid) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 },
      );
    }

    // Check if current user can manage the team
    const canManage = await canManageTeam(
      supabase,
      user.userId,
      params.teamId,
      orgContext.organizationId,
    );

    if (!canManage) {
      return NextResponse.json(
        {
          error: 'You do not have permission to manage this team',
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const {
      email,
      userId: providedUserId,
      role,
    } = body as {
      email?: string;
      userId?: string;
      role?: string;
    };

    // Accept either userId or email
    let targetUserId = providedUserId;

    if (email && typeof email === 'string') {
      const normalizedEmail = email.trim().toLowerCase();

      // Look up user by email
      const {
        data: authUsers,
        error: authError,
      } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (authError) {
        console.error('Failed to lookup user:', authError);

        return NextResponse.json(
          { error: 'Failed to lookup user' },
          { status: 500 },
        );
      }

      const foundUser = authUsers.users.find(
        (authUser) =>
          authUser.email?.toLowerCase() === normalizedEmail,
      );

      if (!foundUser) {
        return NextResponse.json(
          {
            error:
              'User not found - invite them to FollowThru first',
          },
          { status: 400 },
        );
      }

      targetUserId = foundUser.id;
    }

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json(
        { error: 'email or userId is required' },
        { status: 400 },
      );
    }

    if (
      !role ||
      !['team_lead', 'member'].includes(role)
    ) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 },
      );
    }

    // Verify target user belongs to the same organization
    const {
      data: orgMember,
      error: orgError,
    } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('organization_id', orgContext.organizationId)
      .maybeSingle();

    if (orgError) {
      console.error(
        'Failed to verify organization membership:',
        orgError,
      );

      return NextResponse.json(
        {
          error:
            'Failed to verify user organization membership',
        },
        { status: 500 },
      );
    }

    if (!orgMember) {
      return NextResponse.json(
        {
          error:
            'User is not a member of this organization',
        },
        { status: 400 },
      );
    }

    // Add member to team
    const {
      data: member,
      error,
    } = await supabase
      .from('team_members')
      .insert({
        team_id: params.teamId,
        user_id: targetUserId,
        role,
      })
      .select(
        'id, team_id, user_id, role, created_at',
      )
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          {
            error:
              'User is already a member of this team',
          },
          { status: 400 },
        );
      }

      console.error(
        'Failed to add team member:',
        error,
      );

      return NextResponse.json(
        { error: 'Failed to add team member' },
        { status: 500 },
      );
    }

    // Resolve identity for the newly added member too
    let emailResult: string | null = null;
    let displayNameResult: string | null = null;
    let fullNameResult: string | null = null;

    const {
      data: profile,
    } = await supabase
      .from('user_profiles')
      .select('display_name, full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profile) {
      displayNameResult = profile.display_name || null;
      fullNameResult = profile.full_name || null;
    }

    const {
      data: authUser,
    } = await supabase.auth.admin.getUserById(
      targetUserId,
    );

    if (authUser?.user) {
      emailResult = authUser.user.email ?? null;
    }

    return NextResponse.json(
      {
        ...member,
        user: {
          id: targetUserId,
          email: emailResult,
          display_name: displayNameResult,
          full_name: fullNameResult,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Team members POST error:', err);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}