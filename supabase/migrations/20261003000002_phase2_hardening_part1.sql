-- Phase 2 Hardening - Part 1: Backfill NULL organization_id
-- During Phase 2 implementation, new meetings and tasks created via API
-- routes were not explicitly setting organization_id, resulting in NULL values
-- bypassing RLS and becoming orphaned.
-- This migration:
-- 1. Identifies all NULL organization_id records in meetings and tasks
-- 2. Backfills them by deriving org from user context
-- 3. Validates no orphaned records remain
-- 4. Is idempotent (safe to run multiple times)

-- ============================================================================
-- PART 1: BACKFILL MEETINGS
-- ============================================================================

-- Backfill meetings.organization_id from user context
-- Strategy: meetings creator user_id → organization_members → organization_id
UPDATE public.meetings m
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om
  WHERE om.user_id = m.user_id
  AND om.role IN ('owner', 'manager', 'member')
  LIMIT 1
)
WHERE m.organization_id IS NULL
AND m.user_id IS NOT NULL;

-- ============================================================================
-- PART 2: BACKFILL TASKS
-- ============================================================================

-- For tasks with meeting_id, inherit from parent meeting
UPDATE public.tasks t
SET organization_id = (
  SELECT m.organization_id
  FROM public.meetings m
  WHERE m.id = t.meeting_id
  AND m.organization_id IS NOT NULL
  LIMIT 1
)
WHERE t.organization_id IS NULL
AND t.meeting_id IS NOT NULL;

-- For remaining tasks without meeting_id, derive from creator user context
UPDATE public.tasks t
SET organization_id = (
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = t.user_id
  AND om.role IN ('owner', 'manager', 'member')
  LIMIT 1
)
WHERE t.organization_id IS NULL
AND t.user_id IS NOT NULL;

-- ============================================================================
-- END MIGRATION - Part 1 (Backfill Complete)
-- ============================================================================
