-- Phase 2 Hardening - Part 2: Add NOT NULL Constraints
-- Make organization_id NOT NULL on meetings and tasks to prevent
-- future NULL inserts and ensure RLS can safely filter by org.
-- Prerequisites: Migration 20261003000002 (backfill) must run first

-- Safety check: fail if NULLs still exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.meetings WHERE organization_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: meetings table still has NULL organization_id. Run backfill migration first.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.tasks WHERE organization_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: tasks table still has NULL organization_id. Run backfill migration first.';
  END IF;
  
  RAISE NOTICE 'Safety check passed: no NULL organization_id values found. Proceeding with constraints.';
END $$;

-- ============================================================================
-- Add NOT NULL constraints
-- ============================================================================

ALTER TABLE public.meetings
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.tasks
ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================================
-- END MIGRATION - Part 2
-- ============================================================================
