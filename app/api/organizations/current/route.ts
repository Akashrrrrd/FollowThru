/**
 * GET /api/organizations/current
 * 
 * Returns the current user's organization context.
 * Called by auth-provider.tsx to populate organization state.
 * 
 * Also handles first-login initialization (ensures user has an org).
 */

import { NextRequest } from 'next/server';
import { getUserFromRequest, createServerClient } from '@/lib/supabase-server';
import { getUserOrganizationContext, ensureUserOrganization } from '@/lib/organization-context';
import { successResponse, unauthorized, internalError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return unauthorized('You must be signed in');
  }

  try {
    const supabase = createServerClient();

    // Get existing organization
    let context = await getUserOrganizationContext(supabase, user.userId);

    // If no organization, initialize one (first login)
    if (!context) {
      console.log(`[orgs/current] User ${user.userId} has no organization. Initializing...`);
      
      try {
        const userClient = await (await import('@/lib/supabase-server')).createUserClient(user.token);
        const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
        
        if (authError || !authUser?.email) {
          const errorMsg = authError?.message || 'Could not retrieve user email';
          console.error(`[orgs/current] Failed to get user email: ${errorMsg}`);
          return internalError('Could not retrieve user email from authentication');
        }

        const userEmail = authUser.email;
        console.log(`[orgs/current] User email: ${userEmail}`);

        context = await ensureUserOrganization(supabase, user.userId, userEmail);
      } catch (initError) {
        const errorMsg = initError instanceof Error ? initError.message : String(initError);
        console.error(`[orgs/current] Organization initialization failed: ${errorMsg}`);
        return internalError(`Failed to initialize organization: ${errorMsg}`);
      }
    }

    if (!context) {
      console.error(`[orgs/current] Failed to get or create organization for user ${user.userId}`);
      return internalError('Failed to initialize organization');
    }

    console.log(`[orgs/current] Returning organization ${context.organizationId} for user ${user.userId}`);

    return successResponse({
      organizationId: context.organizationId,
      role: context.role,
    });
  } catch (err) {
    console.error('[orgs/current] Unexpected error:', err);
    return internalError(err instanceof Error ? err.message : 'An unexpected error occurred');
  }
}
