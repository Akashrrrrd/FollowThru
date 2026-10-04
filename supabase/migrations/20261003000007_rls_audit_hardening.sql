/*
# RLS Audit Hardening - Close Policy Gaps

During Phase 2 RLS audit, one policy gap was identified:
- commitment_continuity_events: Open RLS (ALLOW ALL) without org scoping

This migration:
1. Fixes commitment_continuity_events RLS to enforce org boundaries
2. Adds org_id column for efficient queries
3. Makes continuity events org-scoped (users only see events for tasks in their org)

CRITICAL: commitment_continuity_events is an audit trail of task relationships.
Being open (ALLOW ALL) violates org isolation. Must be org-scoped like tasks.

Root cause: Continuity events added before Phase 1 org foundation; not updated.
*/

-- ============================================================================
-- PART 1: ADD ORGANIZATION_ID TO COMMITMENT_CONTINUITY_EVENTS
-- ============================================================================

-- Add organization_id column to continuity events
ALTER TABLE IF EXISTS public.commitment_continuity_events
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_continuity_events_organization_id 
ON public.commitment_continuity_events(organization_id);

-- ============================================================================
-- PART 2: BACKFILL ORGANIZATION_ID
-- ============================================================================

-- Backfill organization_id from parent task
UPDATE public.commitment_continuity_events ce
SET organization_id = (
  SELECT t.organization_id
  FROM public.tasks t
  WHERE t.id = ce.parent_task_id
)
WHERE ce.organization_id IS NULL
AND ce.parent_task_id IS NOT NULL;

-- Verify backfill (should return 0 if complete)
-- SELECT COUNT(*) FROM public.commitment_continuity_events WHERE organization_id IS NULL;

-- ============================================================================
-- PART 3: UPDATE RLS POLICIES
-- ============================================================================

-- Drop open RLS policies
DROP POLICY IF EXISTS "anon_select_continuity_events" ON public.commitment_continuity_events;
DROP POLICY IF EXISTS "anon_insert_continuity_events" ON public.commitment_continuity_events;

-- Create org-aware SELECT policy
CREATE POLICY "select_org_continuity_events" ON public.commitment_continuity_events FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Create org-aware INSERT policy
-- Only allow inserts for events where parent task is in user's org
CREATE POLICY "insert_org_continuity_events" ON public.commitment_continuity_events FOR INSERT
  TO authenticated WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_continuity_events.parent_task_id
      AND t.organization_id = commitment_continuity_events.organization_id
    )
  );

-- ============================================================================
-- PART 4: ADD NOT NULL CONSTRAINT (AFTER BACKFILL)
-- ============================================================================

-- Make organization_id NOT NULL (after backfill complete)
ALTER TABLE public.commitment_continuity_events
ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================================
-- PART 5: DOCUMENTATION
-- ============================================================================

/*
VERIFICATION AFTER MIGRATION:

1. Check RLS policies exist:
   SELECT * FROM pg_policies
   WHERE tablename = 'commitment_continuity_events'
   ORDER BY policyname;
   
   Expected:
   - select_org_continuity_events (SELECT)
   - insert_org_continuity_events (INSERT)

2. Verify organization_id populated:
   SELECT COUNT(*) FROM commitment_continuity_events WHERE organization_id IS NULL;
   Expected: 0

3. Test org isolation (as user in Org A):
   SELECT * FROM commitment_continuity_events
   WHERE organization_id = 'org-b-uuid';
   Expected: 0 rows (RLS blocks)

4. Test org access (as user in Org A):
   SELECT * FROM commitment_continuity_events
   WHERE organization_id = 'org-a-uuid';
   Expected: Events for this org only
*/

-- ============================================================================
-- END MIGRATION
-- ============================================================================

</content>
