/**
 * POST /api/debug/verify-and-repair
 * 
 * DIAGNOSTIC AND REPAIR ENDPOINT
 * 
 * For debugging only. Verifies organization membership state and repairs if needed.
 * This endpoint requires a valid session and performs database inspection.
 * 
 * Response includes:
 * - Current user's auth ID
 * - Current organization membership count
 * - Suggested repairs
 * - Results of any repairs performed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function getUserWithoutOrganization(supabase: SupabaseClient): Promise<string[] | null> {
  // Try to find users without organization_members
  // We'll use a different approach - just check the current authenticated user
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    console.log('[repair] Starting verification for user:', user.userId);

    // STEP 1: Check current user's organization membership
    console.log('[repair] Step 1: Checking current user org membership...');
    const { data: userOrgs, error: userOrgsError, count: userOrgCount } = await supabase
      .from('organization_members')
      .select('organization_id, role, created_at', { count: 'exact' })
      .eq('user_id', user.userId);

    if (userOrgsError) {
      console.error('[repair] Error querying user orgs:', userOrgsError);
      return NextResponse.json({
        error: 'Failed to query organization_members',
        details: userOrgsError.message,
      }, { status: 500 });
    }

    const membershipCount = userOrgCount || 0;
    console.log(`[repair] User has ${membershipCount} organization memberships`);

    const report: any = {
      user_id: user.userId,
      membership_count_before: membershipCount,
      memberships: userOrgs,
      needs_repair: membershipCount === 0,
    };

    // STEP 2: If user has no organization, create one
    if (membershipCount === 0) {
      console.log('[repair] User has no organization. Creating one...');

      // Get user email from auth
      const userClient = await (await import('@/lib/supabase-server')).createUserClient(user.token);
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      
      if (authError || !authUser?.email) {
        console.error('[repair] Failed to get user email:', authError);
        return NextResponse.json({
          user_id: user.userId,
          membership_count: membershipCount,
          repair_status: 'failed',
          error: 'Could not retrieve user email',
        }, { status: 500 });
      }

      const userEmail = authUser.email;
      console.log(`[repair] User email: ${userEmail}`);

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: `Personal Org (${userEmail})`,
        })
        .select('id')
        .single();

      if (orgError) {
        console.error('[repair] Failed to create organization:', orgError);
        return NextResponse.json({
          user_id: user.userId,
          membership_count: membershipCount,
          repair_status: 'failed',
          error: 'Failed to create organization',
          org_error: orgError.message,
        }, { status: 500 });
      }

      console.log('[repair] Organization created:', orgData.id);
      report.organization_id_created = orgData.id;

      // Create membership
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: user.userId,
          role: 'owner',
        })
        .select('organization_id, role')
        .single();

      if (memberError) {
        console.error('[repair] Failed to create membership:', memberError);
        return NextResponse.json({
          user_id: user.userId,
          membership_count: membershipCount,
          repair_status: 'failed',
          error: 'Failed to create organization membership',
          member_error: memberError.message,
        }, { status: 500 });
      }

      console.log('[repair] Membership created:', memberData);
      report.membership_created = memberData;
      report.repair_status = 'success';
      report.membership_count_after = 1;

      // Verify the fix
      const { data: verifyOrgs, error: verifyError, count: verifyCount } = await supabase
        .from('organization_members')
        .select('organization_id, role', { count: 'exact' })
        .eq('user_id', user.userId);

      if (verifyError) {
        console.error('[repair] Verification failed:', verifyError);
      } else {
        console.log(`[repair] Verification: User now has ${verifyCount} memberships`);
        report.verification_count = verifyCount;
      }
    } else {
      console.log('[repair] User already has organization membership. No repair needed.');
      report.repair_status = 'no_action_needed';
      report.membership_count_after = membershipCount;
    }

    console.log('[repair] Report:', JSON.stringify(report, null, 2));

    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    console.error('[repair] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
