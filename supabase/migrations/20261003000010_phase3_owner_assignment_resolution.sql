/*
# Phase 3: Owner Assignment & Organizational Resolution

Purpose:
Track the owner resolution process for AI-extracted commitments.
Support ambiguous owner matching with human review workflow.
Store team lead reference for accountability.

Existing fields reused:
- owner (text): speaker name as extracted by AI
- owner_user_id (uuid, nullable): deprecated, replaced by assigned_to_user_id
- assigned_to_user_id (uuid, nullable): the actual employee assigned to the task
- team_id (uuid, nullable): task's team

New fields:
- needs_assignment_review (boolean): task awaiting human owner confirmation
- assignment_ambiguity_data (jsonb): resolution candidates for UI/review
- team_lead_id (uuid, nullable): team lead at time of assignment (reference only, not authoritative)

Safety:
- Idempotent (IF NOT EXISTS)
- Backward compatible (nullable new fields, defaults to false/null)
- Non-destructive (no data deletion)
*/

-- ============================================================================
-- PART 1: ADD ASSIGNMENT REVIEW FIELDS
-- ============================================================================

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS needs_assignment_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assignment_ambiguity_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding tasks needing assignment review
CREATE INDEX IF NOT EXISTS idx_tasks_needs_assignment_review
ON public.tasks(user_id, needs_assignment_review)
WHERE needs_assignment_review = true;

-- Index for finding tasks by team lead (useful for future notifications)
CREATE INDEX IF NOT EXISTS idx_tasks_team_lead_id
ON public.tasks(team_lead_id)
WHERE team_lead_id IS NOT NULL;

-- ============================================================================
-- PART 3: COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN public.tasks.needs_assignment_review IS
  'True if task owner resolution was ambiguous and awaits human confirmation';

COMMENT ON COLUMN public.tasks.assignment_ambiguity_data IS
  'JSON: { candidates: [{userId, displayName, confidence, reason}], reason: "..." } when needs_assignment_review=true';

COMMENT ON COLUMN public.tasks.team_lead_id IS
  'Team lead at time of assignment (reference/accountability only; not authoritative for current permissions)';

-- ============================================================================
-- PART 4: VERIFY EXISTING DATA SAFETY
-- ============================================================================

-- Existing tasks: no review needed
-- - needs_assignment_review defaults to false
-- - assignment_ambiguity_data remains null
-- - team_lead_id remains null until first assignment update

-- All existing Phase 1-2 functionality continues unchanged:
-- - RLS policies still enforce org/team boundaries
-- - assigned_to_user_id validation still occurs at API layer
-- - Existing task lookups unaffected

-- ============================================================================
-- END MIGRATION
-- ============================================================================
