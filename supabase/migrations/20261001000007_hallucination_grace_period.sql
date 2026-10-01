-- Add pending_review state and grace_period_ends_at to tasks table
-- Allows commitments flagged as hallucinations to enter review period

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE;

-- Update constraint to allow new states
-- Old constraint: CHECK (state IN ('ACTIVE', 'DISMISSED'))
-- New constraint allows review states

CREATE INDEX idx_tasks_pending_review ON public.tasks(flagged_for_review, grace_period_ends_at);
CREATE INDEX idx_tasks_grace_period ON public.tasks(grace_period_ends_at);
