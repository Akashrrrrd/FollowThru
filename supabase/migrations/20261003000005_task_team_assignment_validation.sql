/*
# Task Team Assignment Validation

REQUIREMENT: When a task has team_id, ensure:
1. team.organization_id == task.organization_id (team belongs to task's org)
2. If task.assigned_to_user_id IS NOT NULL, user must be a team_members of that team

This migration:
1. Creates triggers to validate team consistency at INSERT/UPDATE
2. Prevents orphaned team assignments
3. Ensures assigned users belong to task's team (if team set)
4. Allows NULL team_id (team assignment optional)

Validation Logic:
- team_id can be NULL (task not tied to specific team)
- If team_id IS NOT NULL:
  a) Verify team.organization_id == task.organization_id
  b) If assigned_to_user_id IS NOT NULL, verify user in team_members
- If both NULL: Allow (no team/assignment constraint)
*/

-- ============================================================================
-- PART 1: CREATE VALIDATION FUNCTION FOR TEAM CONSISTENCY
-- ============================================================================

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

-- ============================================================================
-- PART 2: CREATE VALIDATION FUNCTION FOR TEAM MEMBERSHIP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_task_team_assignment()
RETURNS TRIGGER AS $$
DECLARE
  team_membership_exists boolean;
BEGIN
  -- If either team_id or assigned_to_user_id is NULL, skip team membership check
  IF NEW.team_id IS NULL OR NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if assigned user is a member of the task's team
  SELECT EXISTS(
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id
    AND tm.user_id = NEW.assigned_to_user_id
  ) INTO team_membership_exists;

  -- If user not in team, raise error
  IF NOT team_membership_exists THEN
    RAISE EXCEPTION 'Cannot assign task to user who is not a member of the task''s team';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: CREATE TRIGGERS ON TASKS
-- ============================================================================

-- Drop existing triggers if they exist (to allow re-running migration)
DROP TRIGGER IF EXISTS tasks_team_org_consistency ON public.tasks;
DROP TRIGGER IF EXISTS tasks_team_assignment ON public.tasks;

-- Trigger 1: Validate team-org consistency before any modification
CREATE TRIGGER tasks_team_org_consistency
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_team_org_consistency();

-- Trigger 2: Validate team membership (must run AFTER org consistency check)
CREATE TRIGGER tasks_team_assignment
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_team_assignment();

-- ============================================================================
-- PART 4: ADD TEAM_ID INDEX FOR QUERY PERFORMANCE
-- ============================================================================

-- Indexes already created in Phase 2 teams migration:
-- CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON public.tasks(team_id);
-- CREATE INDEX IF NOT EXISTS idx_tasks_team_id_status ON public.tasks(team_id, status);

-- ============================================================================
-- PART 5: DOCUMENTATION
-- ============================================================================

/*
USAGE & VALIDATION FLOW:

1. Create task with team but no assignment:
   INSERT INTO tasks (meeting_id, description, organization_id, team_id, user_id)
   VALUES (..., 'org-uuid', 'team-uuid', 'user-uuid')
   → SUCCESS: team_id validated against org, no membership check needed

2. Create task with team AND assign to team member:
   INSERT INTO tasks (..., team_id = 'team-uuid', assigned_to_user_id = 'team-member-uuid')
   WHERE team-member-uuid IN (SELECT user_id FROM team_members WHERE team_id = 'team-uuid')
   → SUCCESS: both triggers pass validation

3. Attempt to assign task to user NOT in team:
   UPDATE tasks SET assigned_to_user_id = 'non-member-uuid'
   WHERE team_id = 'team-uuid'
   AND non-member-uuid NOT IN (SELECT user_id FROM team_members WHERE team_id = 'team-uuid')
   → FAILS: "Cannot assign task to user who is not a member of the task's team"

4. Attempt cross-org team assignment:
   UPDATE tasks SET team_id = 'other-org-team-uuid'
   WHERE organization_id = 'org-uuid'
   AND other-org-team-uuid belongs to different org
   → FAILS: "Task and team must belong to same organization"

5. Unassign from team (clear assignment):
   UPDATE tasks SET assigned_to_user_id = NULL
   WHERE team_id = 'team-uuid'
   → SUCCESS: NULL allowed, no membership check

6. Remove team from task:
   UPDATE tasks SET team_id = NULL
   WHERE team_id = 'team-uuid'
   → SUCCESS: NULL team allowed

API IMPLEMENTATION NOTES:

When updating task assignment (app/api/tasks/[id]/route.ts):
1. If setting team_id: validate exists and matches org (API layer)
2. If setting assigned_to_user_id with team_id: validate user in team_members (API layer)
3. Database triggers provide second line of defense

This ensures:
- Team boundaries enforced (team must be in same org as task)
- Team membership enforced (assigned user must be team member)
- Graceful degradation (NULL values are allowed)
- Multiple validation layers (API + DB)
*/

-- ============================================================================
-- END MIGRATION
-- ============================================================================

</content>
