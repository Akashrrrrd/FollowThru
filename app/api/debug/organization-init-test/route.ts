/**
 * GET /api/debug/organization-init-test
 * 
 * DIAGNOSTIC ONLY - Test the organization initialization flow.
 * Shows what happens when we try to initialize an organization for the current user.
 * Does NOT actually create/modify anything if already exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createUserClient, getUserFromRequest } from '@/lib/supabase-server';
import { getUserOrganizationContext } from '@/lib/organization-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Step 1: Check if user already has organization
    const existingContext = await getUserOrganizationContext(supabase, user.userId);
    
    if (existingContext) {
      return NextResponse.json({
        user_id: user.userId,
        step: 'existing_org_found',
        organization_id: existingContext.organizationId,
        role: existingContext.role,
        status: 'ok',
      }, { status: 200 });
    }

    // Step 2: User has no organization. Get their email.
    const userClient = createUserClient(user.token);
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !authUser) {
      return NextResponse.json({
        user_id: user.userId,
        step: 'get_auth_user',
        error: 'Failed to get auth user',
        auth_error: authError?.message,
        status: 'failed',
      }, { status: 500 });
    }

    const userEmail = authUser.email || user.userId;

    // Step 3: Try to create organization (but don't actually insert, just simulate)
    const orgName = `Personal Org (${userEmail})`;
    
    return NextResponse.json({
      user_id: user.userId,
      user_email: userEmail,
      step: 'would_create_org',
      org_name: orgName,
      status: 'needs_initialization',
      message: 'User has no organization and would need to call /api/organizations/current to initialize.',
      note: 'This is a diagnostic endpoint. It does not create the organization.',
    }, { status: 200 });
  } catch (err) {
    console.error('[debug] Organization init test error:', err);
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
