-- Phase 7+8: Add priority field to tasks table
-- Enables bulk priority updates and priority-based sorting

-- Add priority column with default value
ALTER TABLE public.tasks ADD COLUMN priority text DEFAULT 'medium' 
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Create index for priority-based filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);

-- Index for combined priority + due_date (common sort pattern)
CREATE INDEX IF NOT EXISTS idx_tasks_priority_due_date ON public.tasks(priority DESC, due_date ASC);

-- Commentary
COMMENT ON COLUMN public.tasks.priority IS 'Commitment priority level: low, medium, high, or urgent. Defaults to medium. Used for prioritization and bulk operations.';
