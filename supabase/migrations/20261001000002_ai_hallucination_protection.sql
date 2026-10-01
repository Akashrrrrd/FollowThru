-- Phase 1: AI Hallucination Protection
-- Detect when AI extracts commitments that don't exist in the transcript

CREATE TABLE IF NOT EXISTS public.hallucination_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  flagged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.5,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.hallucination_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view hallucination flags for their meetings"
  ON public.hallucination_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = hallucination_flags.meeting_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert hallucination flags for their tasks"
  ON public.hallucination_flags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = hallucination_flags.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update hallucination flags"
  ON public.hallucination_flags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = hallucination_flags.task_id
      AND t.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_hallucination_flags_meeting_id ON public.hallucination_flags(meeting_id);
CREATE INDEX idx_hallucination_flags_task_id ON public.hallucination_flags(task_id);
CREATE INDEX idx_hallucination_flags_resolved ON public.hallucination_flags(resolved);
