/**
 * Personal organization cleanup
 *
 * Every user gets an auto-created "Personal Org (email)" at first login. When someone is
 * then invited into a real organization they end up with TWO organizations, and code that
 * looks at "the first organization" sees the empty personal one.
 *
 * After an invitation is accepted we remove the user's membership in their personal org,
 * but ONLY when it is provably unused:
 *   - the user has at least one other organization
 *   - the user is its only member
 *   - it contains no tasks and no meetings
 *   - its only teams (if any) are the auto-created "General" team
 *
 * Only the membership row is removed (the empty organization row is left in place), so
 * this is easy to reverse and cannot hit foreign-key problems.
 */

import { SupabaseClient } from '@supabase/supabase-js';

const PERSONAL_ORG_PREFIX = 'Personal Org (';

async function isUnusedPersonalOrg(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  const [members, tasks, meetings, teams] = await Promise.all([
    supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    supabase.from('teams').select('name').eq('organization_id', organizationId),
  ]);

  if (members.error || tasks.error || meetings.error || teams.error) {
    console.error('[personal-org-cleanup] Could not inspect organization', organizationId);
    return false;
  }

  return (
    members.count === 1 &&
    (tasks.count ?? 0) === 0 &&
    (meetings.count ?? 0) === 0 &&
    (teams.data ?? []).every((t: { name: string }) => t.name === 'General')
  );
}

/** Returns the ids of organizations the user was removed from. Never throws. */
export async function removeUnusedPersonalOrganizations(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const removed: string[] = [];

  try {
    const { data: memberships, error } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId);

    // Never remove the user's only organization
    if (error || !memberships || memberships.length < 2) return removed;

    const ownedIds = memberships.filter((m) => m.role === 'owner').map((m) => m.organization_id);
    if (ownedIds.length === 0) return removed;

    const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', ownedIds);

    const personal = (orgs ?? []).filter(
      (o: { name: string | null }) => typeof o.name === 'string' && o.name.startsWith(PERSONAL_ORG_PREFIX),
    );

    let remaining = memberships.length;
    for (const org of personal) {
      if (remaining < 2) break;
      if (!(await isUnusedPersonalOrg(supabase, org.id))) continue;

      const { error: deleteError } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', org.id)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[personal-org-cleanup] Failed to remove membership:', deleteError);
        continue;
      }

      removed.push(org.id);
      remaining--;
    }
  } catch (err) {
    console.error('[personal-org-cleanup] Unexpected error:', err);
  }

  return removed;
}