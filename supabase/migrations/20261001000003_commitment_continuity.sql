-- Phase 2: Commitment Continuity
-- Track carry-over of unresolved commitments between meetings

CREATE TABLE IF NOT EXISTS public.commitment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  timestamp_in_transcript INT,
  source_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.commitment_carryover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_task_id uuid NOT NULL REFERENCES public.tasks(id),
  carried_over_task_id uuid NOT NULL REFERENCES public.tasks(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.commitment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitment_carryover ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commitment_evidence
CREATE POLICY "Users can view evidence for their tasks"
  ON public.commitment_evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_evidence.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert evidence"
  ON public.commitment_evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_evidence.task_id
      AND t.user_id = auth.uid()
    )
  );

-- RLS Policies for commitment_carryover
CREATE POLICY "Users can view carryover info"
  ON public.commitment_carryover FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_carryover.original_task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert carryover"
  ON public.commitment_carryover FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_carryover.carried_over_task_id
      AND t.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_commitment_evidence_task_id ON public.commitment_evidence(task_id);
CREATE INDEX idx_commitment_evidence_meeting_id ON public.commitment_evidence(meeting_id);
CREATE INDEX idx_commitment_carryover_original ON public.commitment_carryover(original_task_id);
CREATE INDEX idx_commitment_carryover_carried ON public.commitment_carryover(carried_over_task_id);
