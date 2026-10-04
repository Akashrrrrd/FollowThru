/**
 * GET/POST /api/organizations
 * 
 * GET: List all organizations the user belongs to
 * POST: Not supported in Phase 1 (org creation via API not needed)
 */

import { NextResponse, NextRequest } from 'next/server';
import { getUserFromRequest, createServerClient } from '@/lib/supabase-server';
import { getUserOrganizations } from '@/lib/organization-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const contexts = await getUserOrganizations(supabase, user.userId);

    // Get full organization details
    const orgIds = contexts.map((c) => c.organizationId);
    if (orgIds.length === 0) {
      return NextResponse.json({ organizations: [] });
    }

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, created_at, updated_at')
      .in('id', orgIds);

    if (error) throw error;

    // Combine with role info
    const orgsWithRoles = (orgs ?? []).map((org) => {
      const context = contexts.find((c) => c.organizationId === org.id);
      return {
        ...org,
        role: context?.role ?? 'member',
      };
    });

    return NextResponse.json({ organizations: orgsWithRoles });
  } catch (err) {
    console.error('Failed to list organizations:', err);
    return NextResponse.json(
      { error: 'Failed to list organizations' },
      { status: 500 },
    );
  }
}
