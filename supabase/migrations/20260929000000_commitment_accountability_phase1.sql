/*
# Phase 1: Commitment Accountability System

Extends the tasks table to become a full Commitment Ledger with:
- Enhanced lifecycle states (open, in_progress, blocked, completed, overdue)
- AI confidence tracking
- Dependencies and blockers
- Review/approval workflow
- Completion tracking
- History/audit trail

IMPORTANT: This migration is backward compatible.
Existing 'open'/'done'/'overdue' statuses are preserved.
*/

-- 1. Extend task status to support full commitment lifecycle
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'overdue', 'done'));

-- Note: 'done' is kept for backward compatibility, maps to 'completed'

-- 2. Add new columns for commitment accountability
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IN ('high', 'medium', 'low'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocker text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true; -- existing tasks are auto-approved
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Add context fields for better source tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS request_quote text; -- the original request if different from commitment
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS commitment_type text CHECK (commitment_type IN ('explicit', 'collective', 'acceptance'));

-- 4. Create commitment history table for tracking changes
CREATE TABLE IF NOT EXISTS commitment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('created', 'status_changed', 'date_changed', 'blocked', 'unblocked', 'completed', 'updated')),
  old_value text,
  new_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commitment_history_task_id ON commitment_history(task_id);
CREATE INDEX IF NOT EXISTS idx_commitment_history_created_at ON commitment_history(created_at);

-- 5. Enable RLS on commitment_history
ALTER TABLE commitment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_commitment_history" ON commitment_history;
CREATE POLICY "anon_select_commitment_history" ON commitment_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_commitment_history" ON commitment_history;
CREATE POLICY "anon_insert_commitment_history" ON commitment_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 6. Add indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_confidence ON tasks(confidence);
CREATE INDEX IF NOT EXISTS idx_tasks_needs_review ON tasks(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_tasks_approved ON tasks(approved);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner); -- for person-focused queries

-- 7. Update existing tasks to have confidence scores based on status
-- Existing 'done' tasks are high confidence, others are medium
UPDATE tasks 
SET confidence = CASE 
  WHEN status = 'done' THEN 'high'
  ELSE 'medium'
END
WHERE confidence IS NULL;

-- 8. Create a function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Create a function to detect overdue commitments
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET status = 'overdue'
  WHERE due_date IS NOT NULL
    AND due_date < CURRENT_DATE
    AND status NOT IN ('completed', 'done', 'overdue');
END;
$$ LANGUAGE plpgsql;

-- 10. Add comments for documentation
COMMENT ON COLUMN tasks.confidence IS 'AI confidence in extraction: high, medium, or low';
COMMENT ON COLUMN tasks.dependency IS 'What this commitment depends on (e.g., "waiting for client approval")';
COMMENT ON COLUMN tasks.blocker IS 'What is blocking this commitment from completion';
COMMENT ON COLUMN tasks.needs_review IS 'Whether this commitment needs human review before approval';
COMMENT ON COLUMN tasks.approved IS 'Whether this commitment has been approved by a human';
COMMENT ON COLUMN tasks.completed_at IS 'When this commitment was marked as completed';
COMMENT ON COLUMN tasks.request_quote IS 'The original request if someone asked the owner to do this';
COMMENT ON COLUMN tasks.commitment_type IS 'How the commitment was made: explicit (I will), collective (Let us), acceptance (Sure, I will)';

COMMENT ON TABLE commitment_history IS 'Audit trail of all changes to commitments';
COMMENT ON COLUMN commitment_history.change_type IS 'Type of change: created, status_changed, date_changed, blocked, unblocked, completed, updated';
