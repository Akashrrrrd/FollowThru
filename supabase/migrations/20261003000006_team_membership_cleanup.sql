/*
# Team Membership Cleanup on Organization Removal

REQUIREMENT: When a user is removed from an organization,
automatically delete all of their team memberships in that organization.

This migration:
1. Creates a trigger to cascade delete team_members when org_members deleted
2. Prevents orphaned team memberships
3. Maintains data integrity at database level
4. Is transparent to API layer (automatic cleanup)

Cascade Logic:
- When organization_members row deleted for (org_id, user_id)
- Delete all team_members where:
  - user_id matches deleted org member
  - team_id belongs to that organization
- This is safer than ON DELETE CASCADE (explicit trigger gives us visibility)
*/

-- ============================================================================
-- PART 1: CREATE CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_team_memberships_on_org_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is removed from an organization,
  -- delete all their team memberships in that organization
  DELETE FROM public.team_members tm
  WHERE tm.user_id = OLD.user_id
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = tm.team_id
    AND t.organization_id = OLD.organization_id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 2: CREATE TRIGGER ON ORGANIZATION_MEMBERS
-- ============================================================================

-- Drop existing trigger if it exists (to allow re-running migration)
DROP TRIGGER IF EXISTS organization_members_cleanup_teams ON public.organization_members;

-- Create trigger on DELETE
-- Use AFTER DELETE (not BEFORE) so org_members row is already gone
-- but we can still reference OLD values
CREATE TRIGGER organization_members_cleanup_teams
AFTER DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_team_memberships_on_org_removal();

-- ============================================================================
-- PART 3: DOCUMENTATION
-- ============================================================================

/*
USAGE & CLEANUP FLOW:

1. User removed from organization:
   DELETE FROM organization_members
   WHERE user_id = 'user-uuid'
   AND organization_id = 'org-uuid'
   
   Trigger fires AFTER delete:
   - Finds all teams in that organization
   - Deletes user from team_members for each team
   - Cascade happens transparently

2. Example scenario:
   - User "alice" belongs to Org "Acme"
   - Alice is in teams: "Engineering", "Sales"
   - Remove alice from Acme org_members
   
   → Trigger automatically deletes:
     - alice from Engineering team_members
     - alice from Sales team_members
   
   Result: Alice has no team memberships in Acme (correct!)

3. User removed but user_id IS NOT deleted:
   - User remains in auth.users
   - User removed from organization_members
   - Trigger cleans up team_members
   - User can be re-added to org later with fresh team setup

API IMPLEMENTATION NOTES:

Future org member removal endpoint (/api/organizations/[id]/members/[userId]):

```typescript
export async function DELETE(req, { params }) {
  // 1. Verify requesting user is org manager/owner
  // 2. Verify target user exists and is in org
  // 3. Check not removing last owner
  // 4. DELETE from organization_members
  //    → Trigger automatically cleans up team_members
  // 5. Return success
  
  // No need to manually delete team_members - trigger handles it
}
```

VALIDATION:

Check cleanup worked:
SELECT COUNT(*) FROM team_members tm
WHERE tm.user_id = 'deleted-user-uuid'
AND EXISTS (
  SELECT 1 FROM teams t
  WHERE t.id = tm.team_id
  AND t.organization_id = 'org-uuid'
);
-- Should return 0 (no orphaned memberships)
*/

-- ============================================================================
-- END MIGRATION
-- ============================================================================

</content>
