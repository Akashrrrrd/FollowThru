/*
# Phase 3: Commitment Continuity System

Extends the tasks table and adds commitment_continuity_events table
to support linking commitments across meetings.

This enables FollowThru to recognize when a commitment from an earlier 
meeting is being continued, discussed, updated, completed, or delayed 
in a later meeting.
*/

-- 1. Add continuity fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_commitment_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS continuity_status text CHECK (continuity_status IN ('new', 'continued', 'completed', 'blocked', 'rescheduled', 'updated', 'overdue'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS continuity_confidence text CHECK (continuity_confidence IN ('high', 'medium', 'low'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS merged_with_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- 2. Create commitment_continuity_events table
CREATE TABLE IF NOT EXISTS commitment_continuity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  child_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('linked', 'updated', 'completed', 'rescheduled', 'blocked', 'unblocked', 'progress')),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  evidence jsonb NOT NULL, -- {signals: [], signal_scores: {}, final_score: 0.85, reasoning: "..."}
  source_quote_original text NOT NULL,
  source_quote_followup text NOT NULL,
  meeting_original_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  meeting_followup_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_commitment_id ON tasks(parent_commitment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_continuity_status ON tasks(continuity_status);
CREATE INDEX IF NOT EXISTS idx_tasks_continuity_confidence ON tasks(continuity_confidence);
CREATE INDEX IF NOT EXISTS idx_tasks_merged_with_task_id ON tasks(merged_with_task_id);

CREATE INDEX IF NOT EXISTS idx_continuity_events_parent_task_id ON commitment_continuity_events(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_continuity_events_child_task_id ON commitment_continuity_events(child_task_id);
CREATE INDEX IF NOT EXISTS idx_continuity_events_event_type ON commitment_continuity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_continuity_events_confidence ON commitment_continuity_events(confidence);
CREATE INDEX IF NOT EXISTS idx_continuity_events_created_at ON commitment_continuity_events(created_at);

-- 4. Create index for finding follow-ups by original task
CREATE INDEX IF NOT EXISTS idx_continuity_events_parent_meeting ON commitment_continuity_events(meeting_original_id);

-- 5. Enable RLS on commitment_continuity_events
ALTER TABLE commitment_continuity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_continuity_events" ON commitment_continuity_events;
CREATE POLICY "anon_select_continuity_events" ON commitment_continuity_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_continuity_events" ON commitment_continuity_events;
CREATE POLICY "anon_insert_continuity_events" ON commitment_continuity_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 6. Add comments for documentation
COMMENT ON COLUMN tasks.parent_commitment_id IS 'References the original commitment if this task continues an earlier commitment';
COMMENT ON COLUMN tasks.continuity_status IS 'Tracks continuity relationship: new, continued, completed, blocked, rescheduled, updated, overdue';
COMMENT ON COLUMN tasks.continuity_confidence IS 'Confidence in the continuity match: high (auto-linked), medium (needs review), low (kept separate)';
COMMENT ON COLUMN tasks.merged_with_task_id IS 'If this task was merged with another, reference to that task';

COMMENT ON TABLE commitment_continuity_events IS 'Audit trail of all continuity links and follow-up detections';
COMMENT ON COLUMN commitment_continuity_events.parent_task_id IS 'The original commitment being referenced';
COMMENT ON COLUMN commitment_continuity_events.child_task_id IS 'The follow-up/update commitment';
COMMENT ON COLUMN commitment_continuity_events.event_type IS 'Type of continuity event: linked, updated, completed, rescheduled, blocked, unblocked, progress';
COMMENT ON COLUMN commitment_continuity_events.confidence IS 'Confidence in the continuity match';
COMMENT ON COLUMN commitment_continuity_events.evidence IS 'JSON evidence object with signals, scores, and reasoning';
COMMENT ON COLUMN commitment_continuity_events.source_quote_original IS 'Exact quote from original commitment';
COMMENT ON COLUMN commitment_continuity_events.source_quote_followup IS 'Exact quote from follow-up discussion';
COMMENT ON COLUMN commitment_continuity_events.meeting_original_id IS 'Meeting ID where original commitment was made';
COMMENT ON COLUMN commitment_continuity_events.meeting_followup_id IS 'Meeting ID where follow-up was detected';
