import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { OrganizationDashboardService } from '@/lib/organization-dashboard-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/manager
 * POST /api/dashboard/manager
 *
 * Get manager/organization dashboard data.
 *
 * Authorization:
 * - User must be authenticated
 * - User must have role 'owner' or 'manager' in their organization
 *
 * POST Body (optional):
 * - team_id: If provided, returns drill-down for that team
 *
 * Returns:
 * - 200: Manager dashboard data (org-level or team drill-down)
 * - 401: Not authenticated
 * - 403: Not authorized (not manager/owner)
 * - 500: Server error
 */
export async function GET(req: NextRequest) {
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

    // Verify user is manager or owner
    if (orgContext.role !== 'owner' && orgContext.role !== 'manager') {
      return NextResponse.json(
        { error: 'Not authorized (must be manager or owner)' },
        { status: 403 },
      );
    }

    // Get organization dashboard
    const service = new OrganizationDashboardService(supabase);

    let dashboard;
    try {
      dashboard = await service.getDashboard(user.userId, orgContext.organizationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      console.error('[manager-dashboard] Error:', message);
      throw err;
    }

    console.log(
      `[manager-dashboard] Fetched dashboard for user ${user.userId}, org ${orgContext.organizationId}`,
    );

    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[manager-dashboard] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/manager
 *
 * Get manager dashboard with optional drill-down.
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

    // Verify user is manager or owner
    if (orgContext.role !== 'owner' && orgContext.role !== 'manager') {
      return NextResponse.json(
        { error: 'Not authorized (must be manager or owner)' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { team_id } = body as { team_id?: string };

    const service = new OrganizationDashboardService(supabase);

    let data;

    if (team_id) {
      // Return team drill-down
      try {
        data = await service.getTeamDrilldown(user.userId, orgContext.organizationId, team_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch team data';
        console.error('[manager-dashboard] Team drill-down error:', message);

        if (message.includes('Not authorized') || message.includes('not found')) {
          return NextResponse.json(
            { error: 'Team not found or not authorized' },
            { status: 403 },
          );
        }

        throw err;
      }

      console.log(
        `[manager-dashboard] Fetched team drill-down for user ${user.userId}, team ${team_id}`,
      );
    } else {
      // Return organization-level dashboard
      try {
        data = await service.getDashboard(user.userId, orgContext.organizationId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
        console.error('[manager-dashboard] Error:', message);
        throw err;
      }

      console.log(
        `[manager-dashboard] Fetched dashboard for user ${user.userId}, org ${orgContext.organizationId}`,
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[manager-dashboard] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
