/*
# Phase 2 Hardening - Part 2: Add NOT NULL Constraints

CRITICAL CONSTRAINT: Make organization_id NOT NULL on meetings and tasks to prevent
future NULL inserts and ensure RLS can safely filter by org.

Prerequisites:
- Migration 20261003000002_phase2_hardening_part1.sql (backfill) must run first
- All NULL organization_id values must be resolved

This migration:
1. Verifies all NULL values are backfilled (fails if not)
2. Adds NOT NULL constraint to meetings.organization_id
3. Adds NOT NULL constraint to tasks.organization_id
4. Ensures all future inserts require explicit org context

Risk: If backfill incomplete, constraint addition will FAIL (intentional safety check)
Solution: Re-run backfill migration, then retry this migration
*/

-- ============================================================================
-- SAFETY CHECK: VERIFY BACKFILL COMPLETE
-- ============================================================================

/*
Before adding constraints, verify no NULL values remain.
If this check fails, it means:
1. Backfill migration did not run
2. Backfill partially succeeded (some users not in org)
3. New NULLs were inserted after backfill

Resolution:
- Ensure Phase 1 migrations ran (org/org_members created)
- Re-run backfill migration (20261003000002)
- Check for orphaned users (users without org membership)
- For orphaned users: manually assign to org or delete
*/

-- Safety check: fail if NULLs still exist
-- This is a documented check; in production, manually verify before proceeding
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.meetings WHERE organization_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: meetings table still has NULL organization_id. Run backfill migration (20261003000002) first.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.tasks WHERE organization_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: tasks table still has NULL organization_id. Run backfill migration (20261003000002) first.';
  END IF;
  
  RAISE NOTICE 'Safety check passed: no NULL organization_id values found. Proceeding with constraints.';
END $$;

-- ============================================================================
-- PART 1: ADD NOT NULL CONSTRAINT TO MEETINGS
-- ============================================================================

ALTER TABLE public.meetings
ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================================
-- PART 2: ADD NOT NULL CONSTRAINT TO TASKS
-- ============================================================================

ALTER TABLE public.tasks
ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================================
-- PART 3: VERIFICATION
-- ============================================================================

/*
After constraints added:
- All future INSERT/UPDATE on meetings must provide organization_id
- All future INSERT/UPDATE on tasks must provide organization_id
- API layer must enforce: never trust client-provided organization_id
- Always derive from server-side getUserOrganizationContext()
- RLS will safely filter by org constraint
*/

-- ============================================================================
-- END MIGRATION - Part 2 (Constraints Complete)
-- ============================================================================

</content>
