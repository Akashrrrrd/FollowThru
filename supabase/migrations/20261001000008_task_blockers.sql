-- Task blockers/dependencies table
-- Tracks which tasks block others (A blocks B means B can't proceed until A is done)

CREATE TABLE IF NOT EXISTS public.task_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  blocked_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate blockers
  UNIQUE(blocker_task_id, blocked_task_id)
);

-- Enable RLS
ALTER TABLE public.task_blockers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view blockers for their tasks"
  ON public.task_blockers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t1
      WHERE t1.id = task_blockers.blocker_task_id
      AND t1.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t2
      WHERE t2.id = task_blockers.blocked_task_id
      AND t2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert blockers for their tasks"
  ON public.task_blockers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_blockers.blocked_task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete blockers for their tasks"
  ON public.task_blockers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_blockers.blocked_task_id
      AND t.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_task_blockers_blocker ON public.task_blockers(blocker_task_id);
CREATE INDEX idx_task_blockers_blocked ON public.task_blockers(blocked_task_id);
