/**
 * GET /api/users/search?q=email_or_name
 * 
 * Search for users within the current user's organization.
 * Returns list of users matching the query (email or name).
 * 
 * Results include:
 * - User ID (Auth UUID)
 * - Display name / full name
 * - Email
 * - Organization role
 * 
 * Query requirements:
 * - Must be at least 2 characters
 * - Or exact email match
 * - Debounced on frontend to prevent spam
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = new URL(request.url).searchParams.get('q')?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json({
        results: [],
        message: 'Query must be at least 2 characters',
      });
    }

    const supabase = createServerClient();

    // Get user's organization
    const orgContext = await getUserOrganizationContext(supabase, user.userId);

    if (!orgContext) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 403 }
      );
    }

    const searchTerm = query.toLowerCase();
    const isEmail = query.includes('@');

    console.log(`[/api/users/search] User ${user.userId} searching for: "${query}" in org ${orgContext.organizationId}`);

    let results;

    if (isEmail) {
      // Exact email match - search by email
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          display_name,
          full_name,
          email,
          job_title
        `)
        .eq('email', searchTerm)
        .limit(10);

      if (error) {
        console.error('[/api/users/search] Email search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      results = data || [];
    } else {
      // Fuzzy search by name - search display_name, full_name
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          display_name,
          full_name,
          email,
          job_title
        `)
        .or(`display_name.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) {
        console.error('[/api/users/search] Name search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      results = data || [];
    }

    // Filter results to only users in the same organization
    const { data: memberIds } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgContext.organizationId);

    const allowedUserIds = new Set((memberIds || []).map(m => m.user_id));

    // Filter and enrich results with organization role
    const filtered = results.filter(r => allowedUserIds.has(r.id));

    if (filtered.length === 0) {
      console.log(`[/api/users/search] No results for query: "${query}"`);
      return NextResponse.json({ results: [] });
    }

    // Get organization roles for filtered users
    const { data: roles } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', orgContext.organizationId)
      .in('user_id', filtered.map(r => r.id));

    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

    const enrichedResults = filtered
      .map(profile => ({
        userId: profile.id,
        displayName: profile.display_name,
        fullName: profile.full_name,
        email: profile.email,
        jobTitle: profile.job_title,
        orgRole: roleMap.get(profile.id) || 'member',
      }))
      .sort((a, b) => {
        // Sort: exact match first, then by name
        const aName = (a.displayName || a.fullName || '').toLowerCase();
        const bName = (b.displayName || b.fullName || '').toLowerCase();
        if (aName === searchTerm) return -1;
        if (bName === searchTerm) return 1;
        return aName.localeCompare(bName);
      });

    console.log(`[/api/users/search] Returning ${enrichedResults.length} results for query: "${query}"`);

    return NextResponse.json({ results: enrichedResults });
  } catch (err) {
    console.error('[/api/users/search] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
