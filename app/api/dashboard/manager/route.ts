import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { OrganizationDashboardService } from '@/lib/organization-dashboard-service';
import { successResponse, unauthorized, validationError, internalError, insufficientPermissions } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/manager
 *
 * Get manager/organization dashboard data.
 * User must be authenticated and have 'owner' or 'manager' role.
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

    if (orgContext.role !== 'owner' && orgContext.role !== 'manager') {
      return insufficientPermissions('organization dashboard');
    }

    const service = new OrganizationDashboardService(supabase);

    try {
      const dashboard = await service.getDashboard(user.userId, orgContext.organizationId);
      console.log(`[manager-dashboard] Fetched dashboard for user ${user.userId}`);
      return successResponse(dashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      console.error('[manager-dashboard] Error:', message);
      throw err;
    }
  } catch (err) {
    console.error('[manager-dashboard] Error:', err);
    return internalError('An unexpected error occurred');
  }
}

/**
 * POST /api/dashboard/manager
 *
 * Get manager dashboard with optional team drill-down.
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

    if (orgContext.role !== 'owner' && orgContext.role !== 'manager') {
      return insufficientPermissions('organization dashboard');
    }

    const body = await req.json().catch(() => ({}));
    const { team_id } = body as { team_id?: string };

    const service = new OrganizationDashboardService(supabase);

    try {
      if (team_id) {
        const data = await service.getTeamDrilldown(user.userId, orgContext.organizationId, team_id);
        console.log(`[manager-dashboard] Fetched team drill-down for team ${team_id}`);
        return successResponse(data);
      } else {
        const data = await service.getDashboard(user.userId, orgContext.organizationId);
        console.log(`[manager-dashboard] Fetched dashboard for user ${user.userId}`);
        return successResponse(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch dashboard';
      console.error('[manager-dashboard] Error:', message);
      
      if (message.includes('Not authorized') || message.includes('not found')) {
        return validationError('Team not found or not authorized');
      }
      
      throw err;
    }
  } catch (err) {
    console.error('[manager-dashboard] Error:', err);
    return internalError('An unexpected error occurred');
  }
}
