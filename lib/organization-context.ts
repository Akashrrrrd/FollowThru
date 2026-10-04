/**
 * Organization Context
 * 
 * Helpers to resolve user's organization membership from the database.
 * Critical for Phase 1: every authenticated user must belong to an organization.
 * 
 * Security: These functions query the database to verify membership.
 * Never trust organization_id from frontend requests.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  role: 'owner' | 'manager' | 'member';
}

/**
 * Get the user's organization context.
 * 
 * Returns the user's organization ID, role, and user ID.
 * Queries organization_members table to verify membership.
 * 
 * Returns null if user has no organization (should not happen in Phase 1+).
 * Returns the first organization if user belongs to multiple (Phase 1 limitation).
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to look up
 * @returns Organization context or null if not found
 */
export async function getUserOrganizationContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizationContext | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to get user organization context:', error);
    return null;
  }

  if (!data) {
    console.warn(`User ${userId} has no organization membership`);
    return null;
  }

  return {
    organizationId: data.organization_id,
    userId,
    role: data.role as 'owner' | 'manager' | 'member',
  };
}

/**
 * Get all organizations the user is a member of.
 * Phase 1: typically 1. Phase 2+: may have multiple.
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @returns Array of organization contexts
 */
export async function getUserOrganizations(
  supabase: SupabaseClient,
  userId: string,
): Promise<OrganizationContext[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get user organizations:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    organizationId: row.organization_id,
    userId,
    role: row.role as 'owner' | 'manager' | 'member',
  }));
}

/**
 * Verify that a user belongs to an organization.
 * Used for authorization checks in API routes.
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID
 * @param organizationId - Organization ID to verify membership
 * @returns true if user is a member of the organization
 */
export async function userBelongsToOrganization(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to verify organization membership:', error);
    return false;
  }

  return !!data;
}

/**
 * Ensure user has an organization.
 * Called on first login (task #8).
 * 
 * If user has no organization, creates one and adds membership.
 * If user already has one, returns existing context.
 * 
 * IDEMPOTENT: Safe to call multiple times. Only creates if needed.
 * Handles concurrent requests gracefully via unique constraints.
 * 
 * @param supabase - Service role client (bypasses RLS)
 * @param userId - User ID
 * @param userEmail - User email (for org name)
 * @returns Organization context (newly created or existing)
 * @throws Error if organization creation or membership fails
 */
export async function ensureUserOrganization(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<OrganizationContext | null> {
  try {
    // Check if user already has an organization
    const existing = await getUserOrganizationContext(supabase, userId);
    if (existing) {
      console.log(`[ensureUserOrganization] User ${userId} already has organization ${existing.organizationId}`);
      return existing;
    }

    console.log(`[ensureUserOrganization] Creating organization for user ${userId}`);

    // Create a new personal organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: `Personal Org (${userEmail})`,
      })
      .select('id')
      .single();

    if (orgError) {
      throw new Error(`Failed to create organization: ${orgError.message} (code: ${orgError.code})`);
    }

    if (!orgData) {
      throw new Error('Organization created but no data returned');
    }

    console.log(`[ensureUserOrganization] Organization created: ${orgData.id}`);

    // Add user as owner
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: userId,
        role: 'owner',
      })
      .select('organization_id, role')
      .single();

    if (memberError) {
      // Check if it's a unique constraint violation (concurrent request won it)
      if (memberError.code === '23505') {
        console.log(`[ensureUserOrganization] Membership already exists (concurrent request won race)`);
        // Membership already exists, return it
        const retryContext = await getUserOrganizationContext(supabase, userId);
        if (retryContext) {
          return retryContext;
        }
      }
      throw new Error(`Failed to add user to organization: ${memberError.message} (code: ${memberError.code})`);
    }

    if (!memberData) {
      throw new Error('Membership created but no data returned');
    }

    console.log(`[ensureUserOrganization] Membership created for user ${userId} in org ${memberData.organization_id}`);

    return {
      organizationId: memberData.organization_id,
      userId,
      role: memberData.role as 'owner' | 'manager' | 'member',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ensureUserOrganization] Error for user ${userId}: ${message}`);
    throw err; // Propagate error so caller knows initialization failed
  }
}
