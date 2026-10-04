import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { TeamLeadDashboardService } from '@/lib/team-lead-dashboard-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/team-lead?team_id=...
 *
 * Get team dashboard data for a team lead.
 *
 * Authorization:
 * - User must be authenticated
 * - User must have role 'team_lead' in the requested team
 * - Team must belong to user's organization
 *
 * Query Parameters:
 * - team_id (required): Team ID to fetch dashboard for
 *
 * Returns:
 * - 200: Team dashboard data
 * - 400: Missing required parameters
 * - 401: Not authenticated
 * - 403: Not authorized (not team_lead)
 * - 500: Server error
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization context (server-validated)
    const supabase = createServerClient();
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    // Get team_id from query
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('team_id');

    if (!teamId) {
      return NextResponse.json(
        { error: 'Missing required parameter: team_id' },
        { status: 400 },
      );
    }

    // Get dashboard
    const service = new TeamLeadDashboardService(supabase);

    let dashboard;
    try {
      dashboard = await service.getDashboard(user.userId, teamId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      console.error('[team-lead-dashboard] Authorization error:', message);

      // Don't expose authorization details
      if (message.includes('Not authorized') || message.includes('not found')) {
        return NextResponse.json(
          { error: 'Not authorized to view this team' },
          { status: 403 },
        );
      }

      throw err;
    }

    // Verify team belongs to user's organization
    if (dashboard.organization_id !== orgContext.organizationId) {
      return NextResponse.json(
        { error: 'Team does not belong to your organization' },
        { status: 403 },
      );
    }

    console.log(`[team-lead-dashboard] Fetched dashboard for user ${user.userId}, team ${teamId}`);

    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[team-lead-dashboard] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/dashboard/team-lead/teams
 *
 * List all teams where user is team_lead.
 *
 * Returns:
 * - 200: List of teams
 * - 401: Not authenticated
 * - 500: Server error
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get organization context (server-validated)
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { team_id } = body as { team_id?: string };

    // If team_id provided, get specific team dashboard
    if (team_id) {
      const service = new TeamLeadDashboardService(supabase);

      let dashboard;
      try {
        dashboard = await service.getDashboard(user.userId, team_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
        if (message.includes('Not authorized') || message.includes('not found')) {
          return NextResponse.json(
            { error: 'Not authorized to view this team' },
            { status: 403 },
          );
        }
        throw err;
      }

      if (dashboard.organization_id !== orgContext.organizationId) {
        return NextResponse.json(
          { error: 'Team does not belong to your organization' },
          { status: 403 },
        );
      }

      return NextResponse.json(dashboard);
    }

    // Otherwise, list all teams where user is lead
    const service = new TeamLeadDashboardService(supabase);
    const teams = await service.getTeamsWhereLead(user.userId, orgContext.organizationId);

    console.log(
      `[team-lead-dashboard] Fetched ${teams.length} teams for user ${user.userId}`,
    );

    return NextResponse.json({
      teams,
      count: teams.length,
    });
  } catch (err) {
    console.error('[team-lead-dashboard] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
