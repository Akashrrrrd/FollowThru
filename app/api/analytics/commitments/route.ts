/**
 * Analytics API - Commitments
 *
 * GET /api/analytics/commitments
 *
 * Returns advanced analytics metrics for commitments.
 * Respects team scope and role-based access:
 * - Manager: sees all organization commitments
 * - Team Lead: sees only commitments in their teams
 * - Member: sees only their personal commitments
 *
 * Query Parameters:
 * - startDate: ISO date (default: 30 days ago)
 * - endDate: ISO date (default: today)
 * - status: comma-separated status list (open,in_progress,blocked,completed,overdue,done)
 * - teamId: drill down to specific team (managers/team leads only)
 * - userId: drill down to specific user (team leads and user themselves only)
 */

import { NextRequest } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeams } from '@/lib/team-authorization';
import { getAnalytics, getEscalationTrend, getCompletionTrend } from '@/lib/analytics-service';
import { successResponse, unauthorized, validationError, internalError, insufficientPermissions } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return unauthorized('You must be signed in');
    }

    const supabase = createServerClient();

    // Get organization context
    const orgContext = await getUserOrganizationContext(supabase, user.userId);
    if (!orgContext) {
      return validationError('User has no organization membership');
    }

    // Determine accessible teams
    const isManager = orgContext.role === 'owner' || orgContext.role === 'manager';
    let accessibleTeamIds: string[] = [];

    if (isManager) {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('organization_id', orgContext.organizationId);

      if (teamsError) {
        return internalError('Failed to fetch teams');
      }
      accessibleTeamIds = teams?.map((t) => t.id) || [];
    } else {
      const userTeams = await getUserTeams(supabase, user.userId, orgContext.organizationId);
      accessibleTeamIds = userTeams.map((t: any) => t.teamId);
    }

    if (accessibleTeamIds.length === 0) {
      return validationError('User has no teams');
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') || undefined;
    const teamId = searchParams.get('teamId') || undefined;
    const userId = searchParams.get('userId') || undefined;

    // Validate team drill-down permissions
    if (teamId && !isManager) {
      const userTeams = await getUserTeams(supabase, user.userId, orgContext.organizationId);
      const userTeamIds = userTeams.map((t: any) => t.teamId);

      if (!userTeamIds.includes(teamId)) {
        return insufficientPermissions('team');
      }

      const teamLeadTeams = userTeams
        .filter((t: any) => t.role === 'team_lead')
        .map((t: any) => t.teamId);

      if (!teamLeadTeams.includes(teamId)) {
        return insufficientPermissions('team analytics');
      }
    }

    // Validate user drill-down permissions
    if (userId && userId !== user.userId && !isManager) {
      return insufficientPermissions('user analytics');
    }

    // Fetch analytics
    const filters: any = {
      startDate,
      endDate,
      status,
      teamId,
      userId,
    };

    if (!isManager) {
      filters.userId = user.userId;
    }

    const analytics = await getAnalytics(supabase, accessibleTeamIds, filters);
    const escalationTrend = await getEscalationTrend(supabase, accessibleTeamIds, 30);
    const completionTrend = await getCompletionTrend(supabase, accessibleTeamIds, 12);

    return successResponse({
      analytics,
      trends: {
        escalation: escalationTrend,
        completion: completionTrend,
      },
    });
  } catch (err) {
    console.error('[Analytics API] Error:', err);
    return internalError('An unexpected error occurred');
  }
}
