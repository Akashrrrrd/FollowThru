import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { TeamLeadDashboardService } from '@/lib/team-lead-dashboard-service';
import { successResponse, unauthorized, validationError, internalError, insufficientPermissions } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/team-lead?team_id=...
 *
 * Get team dashboard data for a team lead.
 * Query Parameters:
 * - team_id (required): Team ID to fetch dashboard for
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return validationError('User has no organization membership');
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('team_id');

    if (!teamId) {
      return validationError('Missing required parameter: team_id', { field: 'team_id' });
    }

    const service = new TeamLeadDashboardService(supabase);

    try {
      const dashboard = await service.getDashboard(user.userId, teamId);

      if (dashboard.organization_id !== orgContext.organizationId) {
        return insufficientPermissions('team');
      }

      console.log(`[team-lead-dashboard] Fetched dashboard for team ${teamId}`);
      return successResponse(dashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      console.error('[team-lead-dashboard] Authorization error:', message);

      if (message.includes('Not authorized') || message.includes('not found')) {
        return insufficientPermissions('team dashboard');
      }

      throw err;
    }
  } catch (err) {
    console.error('[team-lead-dashboard] Error:', err);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/dashboard/team-lead
 *
 * Get team dashboard with optional team drill-down, or list all teams where user is lead.
 * Request body: { team_id?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();

    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return validationError('User has no organization membership');
    }

    const body = await req.json().catch(() => ({}));
    const { team_id } = body as { team_id?: string };

    // If team_id provided, get specific team dashboard
    if (team_id) {
      const service = new TeamLeadDashboardService(supabase);

      try {
        const dashboard = await service.getDashboard(user.userId, team_id);

        if (dashboard.organization_id !== orgContext.organizationId) {
          return insufficientPermissions('team');
        }

        console.log(`[team-lead-dashboard] Fetched dashboard for team ${team_id}`);
        return successResponse(dashboard);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
        if (message.includes('Not authorized') || message.includes('not found')) {
          return insufficientPermissions('team dashboard');
        }
        throw err;
      }
    }

    // List all teams where user is lead
    const service = new TeamLeadDashboardService(supabase);
    const teams = await service.getTeamsWhereLead(user.userId, orgContext.organizationId);

    console.log(`[team-lead-dashboard] Fetched ${teams.length} teams for user ${user.userId}`);

    return successResponse({
      teams,
      count: teams.length,
    });
  } catch (err) {
    console.error('[team-lead-dashboard] Error:', err);
    return internalError('An unexpected error occurred');
  }
}
