-- Add reminder tracking fields to tasks table

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue_reminder_sent_at timestamptz DEFAULT NULL;

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_due_date ON tasks(due_date) 
WHERE status IN ('open', 'in_progress') AND reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_overdue_reminder ON tasks(due_date) 
WHERE status IN ('open', 'in_progress') AND overdue_reminder_sent_at IS NULL;
