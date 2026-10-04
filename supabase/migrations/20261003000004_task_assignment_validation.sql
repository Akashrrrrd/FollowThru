/*
# Task Assignment Organization Validation

REQUIREMENT: When a task is assigned to a user via assigned_to_user_id,
that user must belong to the same organization as the task.

This migration:
1. Creates a TRIGGER to validate org membership on assignment
2. Prevents cross-org task assignments
3. Allows NULL assigned_to_user_id (unassigned tasks)
4. Is checked at INSERT and UPDATE time

Validation Logic:
- If assigned_to_user_id IS NULL: Allow (unassigned is valid)
- If assigned_to_user_id IS NOT NULL: 
  - Check: organization_id of task == organization_id of assigned_to_user via org_members
  - If NO match: REJECT with clear error
  - If MATCH: Allow
*/

-- ============================================================================
-- PART 1: CREATE VALIDATION FUNCTION
-- ============================================================================

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
  -- Get the organization_id of the assigned_to_user
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

-- ============================================================================
-- PART 2: CREATE TRIGGER ON TASKS
-- ============================================================================

-- Drop existing trigger if it exists (to allow re-running migration)
DROP TRIGGER IF EXISTS tasks_assignment_org_validation ON public.tasks;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER tasks_assignment_org_validation
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_assignment_org();

-- ============================================================================
-- PART 3: DOCUMENTATION
-- ============================================================================

/*
USAGE & VALIDATION FLOW:

1. Assigning task to user in same org:
   UPDATE tasks SET assigned_to_user_id = 'user-uuid' 
   WHERE organization_id = 'org-uuid'
   AND EXISTS(SELECT 1 FROM organization_members 
     WHERE user_id = 'user-uuid' AND organization_id = 'org-uuid')
   → SUCCESS: trigger validates and allows

2. Attempting cross-org assignment:
   UPDATE tasks SET assigned_to_user_id = 'other-org-user-uuid'
   WHERE organization_id = 'org-uuid'
   AND assigned_to_user_id belongs to different org
   → FAILS: trigger rejects with "Cannot assign task to user from different organization"

3. Unassigning task (clearing assignment):
   UPDATE tasks SET assigned_to_user_id = NULL
   → SUCCESS: trigger allows NULL (unassigned)

API IMPLEMENTATION NOTES:

In app/api/tasks/[id]/route.ts PATCH handler:
1. Accept assigned_to_user_id in body
2. Validate: assigned_to_user_id must be in same org as task
   - Fetch task's organization_id
   - Query org_members to verify assigned user is in that org
   - If NOT: return 400 Bad Request
   - If YES: allow update
3. Database trigger provides second line of defense

This pattern:
- Prevents bugs from client-side validation bypass
- Catches race conditions (user removed from org between validation & update)
- Database layer is source of truth for security
*/

-- ============================================================================
-- END MIGRATION
-- ============================================================================

</content>
