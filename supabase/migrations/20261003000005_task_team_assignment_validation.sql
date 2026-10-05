-- Task Team Assignment Validation
-- Ensure team consistency: team.organization_id == task.organization_id
-- If task has team_id, assigned user must be team member

-- Create validation function for team consistency
CREATE OR REPLACE FUNCTION public.validate_task_team_org_consistency()
RETURNS TRIGGER AS $$
DECLARE
  team_org_id uuid;
BEGIN
  -- If team_id is NULL, team assignment is optional - allow
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If team_id is set, validate it belongs to same org as task
  SELECT t.organization_id INTO team_org_id
  FROM public.teams t
  WHERE t.id = NEW.team_id
  LIMIT 1;

  -- If team not found or wrong org, raise error
  IF team_org_id IS NULL THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  IF team_org_id != NEW.organization_id THEN
    RAISE EXCEPTION 'Task and team must belong to same organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS check_task_team_org_consistency ON public.tasks;

-- Create trigger on tasks table
CREATE TRIGGER check_task_team_org_consistency
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_team_org_consistency();

-- Create validation function for team membership
CREATE OR REPLACE FUNCTION public.validate_task_team_member_assignment()
RETURNS TRIGGER AS $$
DECLARE
  is_team_member boolean;
BEGIN
  -- If either team_id or assigned_to_user_id is NULL, allow
  IF NEW.team_id IS NULL OR NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user is member of the team
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id
    AND tm.user_id = NEW.assigned_to_user_id
  ) INTO is_team_member;

  -- If user not in team, raise error
  IF NOT is_team_member THEN
    RAISE EXCEPTION 'Assigned user must be a member of task team';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS check_task_team_member_assignment ON public.tasks;

-- Create trigger on tasks table
CREATE TRIGGER check_task_team_member_assignment
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_team_member_assignment();
