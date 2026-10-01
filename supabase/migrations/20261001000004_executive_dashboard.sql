-- Phase 3: Executive Dashboard
-- Metrics for follow-through rate, velocity, decision revisits

CREATE TABLE IF NOT EXISTS public.executive_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  follow_through_percentage FLOAT NOT NULL DEFAULT 0,
  total_commitments INT NOT NULL DEFAULT 0,
  completed_commitments INT NOT NULL DEFAULT 0,
  dismissed_commitments INT NOT NULL DEFAULT 0,
  velocity_current FLOAT NOT NULL DEFAULT 0,
  velocity_previous FLOAT NOT NULL DEFAULT 0,
  computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.decision_revisits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  revisit_count INT NOT NULL DEFAULT 1,
  reschedule_count INT NOT NULL DEFAULT 0,
  scope_changes INT NOT NULL DEFAULT 0,
  last_revisited TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.executive_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_revisits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own metrics"
  ON public.executive_metrics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view revisits for their tasks"
  ON public.decision_revisits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = decision_revisits.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert revisits"
  ON public.decision_revisits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = decision_revisits.task_id
      AND t.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_executive_metrics_user_id ON public.executive_metrics(user_id);
CREATE INDEX idx_executive_metrics_period ON public.executive_metrics(period);
CREATE INDEX idx_decision_revisits_task_id ON public.decision_revisits(task_id);
CREATE INDEX idx_decision_revisits_meeting_id ON public.decision_revisits(meeting_id);
