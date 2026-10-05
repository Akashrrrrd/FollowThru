/*
# Phase 4: Escalation Tracking Columns

Extends tasks table with escalation-specific fields for deterministic tracking.
These columns work in concert with escalation_state and escalation_history tables.

## New Columns

1. escalation_sent_at
   - Tracks when first escalation was sent
   - NULL = no escalation yet sent
   - Used in atomic guards to prevent duplicate escalations

2. escalation_level
   - Current escalation level (0, 1, 2, 3)
   - 0 = not escalated, 1 = team_lead, 2 = manager, 3 = owner
   - Denormalized from escalation_state for performance

3. escalation_cancelled_at
   - When escalation was cancelled/voided (e.g., commitment completed)
   - NULL = escalation still active
   - Prevents re-escalation after resolution

## Compatibility

- Does NOT modify existing columns
- Does NOT break existing queries
- Extension is additive only
*/

-- ============================================================================
-- EXTEND tasks TABLE WITH ESCALATION COLUMNS
-- ============================================================================

-- First escalation timestamp (for idempotency)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS escalation_sent_at timestamptz DEFAULT NULL;

-- Current escalation level (0-3, denormalized from escalation_state)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS escalation_level smallint DEFAULT 0
  CHECK (escalation_level >= 0 AND escalation_level <= 3);

-- When escalation was cancelled (commitment completed or reassigned)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS escalation_cancelled_at timestamptz DEFAULT NULL;

-- ============================================================================
-- CREATE INDEXES FOR ESCALATION QUERIES
-- ============================================================================

-- Find commitments eligible for first escalation (24h overdue, not yet escalated)
CREATE INDEX IF NOT EXISTS idx_tasks_escalation_24h ON public.tasks(due_date)
  WHERE status IN ('open', 'in_progress')
    AND escalation_sent_at IS NULL
    AND escalation_cancelled_at IS NULL
    AND due_date IS NOT NULL;

-- Find commitments escalated to team lead (eligible for manager escalation)
CREATE INDEX IF NOT EXISTS idx_tasks_escalation_level_1 ON public.tasks(due_date)
  WHERE status IN ('open', 'in_progress')
    AND escalation_level = 1
    AND escalation_cancelled_at IS NULL
    AND due_date IS NOT NULL;

-- Find commitments escalated to manager (eligible for owner escalation)
CREATE INDEX IF NOT EXISTS idx_tasks_escalation_level_2 ON public.tasks(due_date)
  WHERE status IN ('open', 'in_progress')
    AND escalation_level = 2
    AND escalation_cancelled_at IS NULL
    AND due_date IS NOT NULL;

-- ============================================================================
-- UTILITY FUNCTION: Clear escalation on completion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_escalation_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When task is completed, void the escalation
  IF NEW.status IN ('completed', 'done') AND OLD.status NOT IN ('completed', 'done') THEN
    NEW.escalation_cancelled_at = CURRENT_TIMESTAMP;
    NEW.escalation_level = 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clear escalation when task is completed
DROP TRIGGER IF EXISTS tasks_clear_escalation_on_completion ON public.tasks;
CREATE TRIGGER tasks_clear_escalation_on_completion
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_escalation_on_completion();

-- ============================================================================
-- UTILITY FUNCTION: Clear escalation on reassignment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_escalation_on_reassignment()
RETURNS TRIGGER AS $$
BEGIN
  -- When assigned_to_user_id changes, reset escalation
  -- (new assignee gets fresh reminder/escalation cycle)
  IF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
    NEW.escalation_sent_at = NULL;
    NEW.escalation_level = 0;
    NEW.escalation_cancelled_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to reset escalation when task is reassigned
DROP TRIGGER IF EXISTS tasks_clear_escalation_on_reassignment ON public.tasks;
CREATE TRIGGER tasks_clear_escalation_on_reassignment
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_escalation_on_reassignment();

-- ============================================================================
-- HELPER VIEW: Commitments eligible for escalation
-- ============================================================================

CREATE OR REPLACE VIEW public.v_commitments_eligible_for_escalation AS
SELECT
  t.id,
  t.organization_id,
  t.team_id,
  t.assigned_to_user_id,
  t.due_date,
  t.status,
  t.escalation_level,
  t.escalation_sent_at,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.due_date)) / 3600 AS hours_overdue,
  CASE
    WHEN t.escalation_level = 0 AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.due_date)) / 3600 >= 24 THEN 'eligible_for_escalation_1'
    WHEN t.escalation_level = 1 AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.due_date)) / 3600 >= 48 THEN 'eligible_for_escalation_2'
    WHEN t.escalation_level = 2 AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.due_date)) / 3600 >= 72 THEN 'eligible_for_escalation_3'
    ELSE 'not_eligible'
  END AS escalation_status
FROM public.tasks t
WHERE t.status IN ('open', 'in_progress')
  AND t.escalation_cancelled_at IS NULL
  AND t.due_date IS NOT NULL
  AND t.due_date < CURRENT_TIMESTAMP;

COMMENT ON VIEW public.v_commitments_eligible_for_escalation IS
  'View of commitments eligible for escalation based on current time and escalation policy.';
