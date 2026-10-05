-- Task Assignment Organization Validation
-- When a task is assigned to a user via assigned_to_user_id,
-- that user must belong to the same organization as the task.

-- Create validation function for task assignment
CREATE OR REPLACE FUNCTION public.validate_task_assignment_org()
RETURNS TRIGGER AS $$
DECLARE
  assigned_user_org_id uuid;
BEGIN
  -- If assigned_to_user_id is NULL, assignment is allowed (unassigned)
  IF NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If assigned_to_user_id is set, validate org membership
  SELECT om.organization_id INTO assigned_user_org_id
  FROM public.organization_members om
  WHERE om.user_id = NEW.assigned_to_user_id
  AND om.organization_id = NEW.organization_id
  LIMIT 1;

  -- If user not found in same org, raise error
  IF assigned_user_org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign task to user from different organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS check_task_assignment_org ON public.tasks;

-- Create trigger on tasks table
CREATE TRIGGER check_task_assignment_org
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_assignment_org();
