-- Team Membership Cleanup on Organization Removal
-- When a user is removed from an organization,
-- automatically delete all of their team memberships in that organization.

-- Create function to cascade delete team memberships
CREATE OR REPLACE FUNCTION public.cleanup_team_memberships_on_org_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all team memberships for this user in this organization
  DELETE FROM public.team_members tm
  WHERE tm.user_id = OLD.user_id
  AND tm.team_id IN (
    SELECT t.id FROM public.teams t
    WHERE t.organization_id = OLD.organization_id
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS cleanup_team_memberships_on_org_removal ON public.organization_members;

-- Create trigger to cascade cleanup
CREATE TRIGGER cleanup_team_memberships_on_org_removal
AFTER DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_team_memberships_on_org_removal();
