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

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  getUserFromRequest,
} from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';
import { getUserTeams } from '@/lib/team-authorization';
import { getAnalytics, getEscalationTrend, getCompletionTrend } from '@/lib/analytics-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    /*
     * -------------------------------------------------------
     * AUTHENTICATION
     * -------------------------------------------------------
     */

    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    /*
     * -------------------------------------------------------
     * ORGANIZATION CONTEXT
     * -------------------------------------------------------
     */

    const orgContext = await getUserOrganizationContext(
      supabase,
      user.userId
    );

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization membership' },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * DETERMINE SCOPE: WHICH TEAMS TO INCLUDE
     * -------------------------------------------------------
     */

    const isManager =
      orgContext.role === 'owner' || orgContext.role === 'manager';

    let accessibleTeamIds: string[] = [];

    if (isManager) {
      // Managers see all teams in organization
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('organization_id', orgContext.organizationId);

      if (teamsError) {
        return NextResponse.json(
          { error: 'Failed to fetch teams' },
          { status: 500 }
        );
      }

      accessibleTeamIds = teams?.map((t) => t.id) || [];
    } else {
      // Non-managers only see their teams
      const userTeams = await getUserTeams(
        supabase,
        user.userId,
        orgContext.organizationId
      );
      accessibleTeamIds = userTeams.map((t: any) => t.teamId);
    }

    if (accessibleTeamIds.length === 0) {
      return NextResponse.json(
        { error: 'User has no teams' },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * PARSE QUERY PARAMETERS
     * -------------------------------------------------------
     */

    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') || undefined;
    const teamId = searchParams.get('teamId') || undefined;
    const userId = searchParams.get('userId') || undefined;

    /*
     * -------------------------------------------------------
     * VALIDATE DRILL-DOWN PERMISSIONS
     * -------------------------------------------------------
     */

    // Team drill-down: only managers and team leads
    if (teamId && !isManager) {
      const userTeams = await getUserTeams(
        supabase,
        user.userId,
        orgContext.organizationId
      );
      const userTeamIds = userTeams.map((t: any) => t.teamId);

      if (!userTeamIds.includes(teamId)) {
        return NextResponse.json(
          { error: 'Unauthorized to access this team' },
          { status: 403 }
        );
      }

      // For team leads, restrict to teams they lead
      const teamLeadTeams = userTeams
        .filter((t: any) => t.role === 'team_lead')
        .map((t: any) => t.teamId);

      if (!teamLeadTeams.includes(teamId)) {
        return NextResponse.json(
          { error: 'Not authorized to view analytics for this team' },
          { status: 403 }
        );
      }
    }

    // User drill-down: members can only see themselves, team leads can see their team members
    if (userId && userId !== user.userId && !isManager) {
      // Non-managers can only view their own analytics
      return NextResponse.json(
        { error: 'Unauthorized to view other user analytics' },
        { status: 403 }
      );
    }

    /*
     * -------------------------------------------------------
     * FETCH ANALYTICS
     * -------------------------------------------------------
     */

    const filters: any = {
      startDate,
      endDate,
      status,
      teamId,
      userId,
    };

    // Members always see only their own commitments
    if (!isManager) {
      filters.userId = user.userId;
    }

    const analytics = await getAnalytics(supabase, accessibleTeamIds, filters);

    /*
     * -------------------------------------------------------
     * FETCH TRENDS (for charts)
     * -------------------------------------------------------
     */

    const escalationTrend = await getEscalationTrend(supabase, accessibleTeamIds, 30);
    const completionTrend = await getCompletionTrend(
      supabase,
      accessibleTeamIds,
      12
    );

    /*
     * -------------------------------------------------------
     * RETURN RESPONSE
     * -------------------------------------------------------
     */

    return NextResponse.json({
      analytics,
      trends: {
        escalation: escalationTrend,
        completion: completionTrend,
      },
    });
  } catch (err) {
    console.error('[Analytics API] Error:', err);

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
