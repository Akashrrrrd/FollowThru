/*
# Phase 2 Hardening - Validation Checks

This migration provides SQL-based validation checks for Phase 2 hardening.
Run this AFTER all hardening migrations to verify:

1. All NULL organization_id records are backfilled
2. All NOT NULL constraints are in place
3. All triggers are created
4. All RLS policies are set correctly
5. No data integrity issues

This migration is IDEMPOTENT and SAFE TO RE-RUN.
It only performs validation (no modifications).

To view validation results:
- Check PostgreSQL NOTICE messages during migration
- Query validation tables created in this migration
*/

-- ============================================================================
-- PART 1: CREATE VALIDATION REPORT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.phase2_validation_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name varchar(255) NOT NULL,
  check_category varchar(100) NOT NULL,
  status varchar(50) NOT NULL,
  details text,
  count_value integer,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Drop previous runs for clean report
DELETE FROM public.phase2_validation_report
WHERE created_at < NOW() - INTERVAL '1 day';

-- ============================================================================
-- PART 2: VALIDATION CHECKS
-- ============================================================================

DO $$
DECLARE
  null_count_meetings integer;
  null_count_tasks integer;
  trigger_count integer;
  policy_count integer;
BEGIN
  -- Check 1: No NULL organization_id in meetings
  SELECT COUNT(*) INTO null_count_meetings
  FROM public.meetings WHERE organization_id IS NULL;
  
  INSERT INTO public.phase2_validation_report (check_name, check_category, status, details, count_value)
  VALUES (
    'No NULL organization_id in meetings',
    'Data Integrity',
    CASE WHEN null_count_meetings = 0 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN null_count_meetings = 0 
      THEN 'All meetings have organization_id'
      ELSE 'Found ' || null_count_meetings || ' meetings with NULL organization_id'
    END,
    null_count_meetings
  );

  -- Check 2: No NULL organization_id in tasks
  SELECT COUNT(*) INTO null_count_tasks
  FROM public.tasks WHERE organization_id IS NULL;
  
  INSERT INTO public.phase2_validation_report (check_name, check_category, status, details, count_value)
  VALUES (
    'No NULL organization_id in tasks',
    'Data Integrity',
    CASE WHEN null_count_tasks = 0 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN null_count_tasks = 0 
      THEN 'All tasks have organization_id'
      ELSE 'Found ' || null_count_tasks || ' tasks with NULL organization_id'
    END,
    null_count_tasks
  );

  -- Check 3: Triggers exist
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'tasks_assignment_org_validation',
    'tasks_team_org_consistency',
    'tasks_team_assignment',
    'organization_members_cleanup_teams'
  );
  
  INSERT INTO public.phase2_validation_report (check_name, check_category, status, details, count_value)
  VALUES (
    'All validation triggers created',
    'Database Triggers',
    CASE WHEN trigger_count = 4 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || trigger_count || ' of 4 expected triggers',
    trigger_count
  );

  -- Check 4: RLS policies exist
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members', 'meetings', 'tasks', 'teams', 'team_members')
  AND policyname LIKE '%org%' OR policyname LIKE '%team%';
  
  INSERT INTO public.phase2_validation_report (check_name, check_category, status, details, count_value)
  VALUES (
    'RLS policies configured',
    'RLS Policies',
    CASE WHEN policy_count >= 6 THEN 'PASS' ELSE 'WARN' END,
    'Found ' || policy_count || ' org/team-aware policies',
    policy_count
  );

  -- Log completion
  RAISE NOTICE 'Phase 2 Hardening Validation Complete';
  RAISE NOTICE 'Meetings with NULL organization_id: %', null_count_meetings;
  RAISE NOTICE 'Tasks with NULL organization_id: %', null_count_tasks;
  RAISE NOTICE 'Validation Triggers: %', trigger_count;
  RAISE NOTICE 'RLS Policies: %', policy_count;
  
END $$;

-- ============================================================================
-- PART 3: VIEW VALIDATION RESULTS
-- ============================================================================

-- Summary
SELECT 
  check_category,
  COUNT(*) as total_checks,
  SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN status = 'WARN' THEN 1 ELSE 0 END) as warnings
FROM public.phase2_validation_report
GROUP BY check_category
ORDER BY check_category;

-- ============================================================================
-- PART 4: CONSTRAINT VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify NOT NULL constraints exist
  PERFORM 1 FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'meetings'
  AND column_name = 'organization_id'
  AND is_nullable = 'NO';
  
  IF NOT FOUND THEN
    RAISE NOTICE 'WARNING: meetings.organization_id is nullable (should be NOT NULL)';
  ELSE
    RAISE NOTICE 'OK: meetings.organization_id is NOT NULL';
  END IF;

  PERFORM 1 FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name = 'organization_id'
  AND is_nullable = 'NO';
  
  IF NOT FOUND THEN
    RAISE NOTICE 'WARNING: tasks.organization_id is nullable (should be NOT NULL)';
  ELSE
    RAISE NOTICE 'OK: tasks.organization_id is NOT NULL';
  END IF;

END $$;

-- ============================================================================
-- PART 5: SAMPLE DATA INTEGRITY CHECKS
-- ============================================================================

DO $$
DECLARE
  orphaned_tasks_count integer;
  orphaned_meetings_count integer;
  mismatched_team_org_count integer;
BEGIN
  -- Check for orphaned tasks (task.meeting_id exists but meeting doesn't)
  SELECT COUNT(*) INTO orphaned_tasks_count
  FROM public.tasks t
  WHERE t.meeting_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = t.meeting_id);
  
  IF orphaned_tasks_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % orphaned tasks', orphaned_tasks_count;
  ELSE
    RAISE NOTICE 'OK: No orphaned tasks found';
  END IF;

  -- Check for mismatched team_id and organization_id
  SELECT COUNT(*) INTO mismatched_team_org_count
  FROM public.tasks t
  WHERE t.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.teams te
    WHERE te.id = t.team_id
    AND te.organization_id = t.organization_id
  );
  
  IF mismatched_team_org_count > 0 THEN
    RAISE NOTICE 'WARNING: Found % tasks with mismatched team_org_id', mismatched_team_org_count;
  ELSE
    RAISE NOTICE 'OK: All team assignments match org boundaries';
  END IF;

END $$;

-- ============================================================================
-- PART 6: FINAL REPORT
-- ============================================================================

-- Show all validation checks
SELECT * FROM public.phase2_validation_report
ORDER BY created_at DESC, check_category, check_name;

-- ============================================================================
-- END MIGRATION - Validation Complete
-- ============================================================================

</content>
