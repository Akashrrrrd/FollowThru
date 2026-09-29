/*
# Create meetings and tasks tables for FollowThru

1. New Tables
- `meetings`: stores pasted meeting transcripts
  - id (uuid, primary key)
  - user_id (text, not null, default 'demo-user' — placeholder for future auth)
  - title (text, not null)
  - transcript (text, not null)
  - created_at (timestamptz, default now())
- `tasks`: stores commitments extracted from meetings
  - id (uuid, primary key)
  - meeting_id (uuid, references meetings.id on delete cascade)
  - user_id (text, not null, default 'demo-user')
  - description (text, not null) — what was promised
  - owner (text, not null) — who made the commitment
  - due_date (date, nullable) — deadline if mentioned
  - source_quote (text, not null) — verbatim sentence from transcript
  - status (text, not null, default 'open', check: open/done/overdue)
  - created_at (timestamptz, default now())

2. Indexes
- tasks.meeting_id for fast per-meeting queries
- tasks.status for filtering
- tasks.due_date for sorting
- tasks.user_id for future multi-user support

3. Security
- RLS enabled on both tables
- Single-tenant demo app (no sign-in): policies use TO anon, authenticated
  so the anon-key frontend can read and write its own data
*/

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'demo-user',
  title text NOT NULL,
  transcript text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  user_id text NOT NULL DEFAULT 'demo-user',
  description text NOT NULL,
  owner text NOT NULL,
  due_date date,
  source_quote text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'overdue')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- meetings policies (single-tenant: anon + authenticated)
DROP POLICY IF EXISTS "anon_select_meetings" ON meetings;
CREATE POLICY "anon_select_meetings" ON meetings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_meetings" ON meetings;
CREATE POLICY "anon_insert_meetings" ON meetings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_meetings" ON meetings;
CREATE POLICY "anon_update_meetings" ON meetings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_meetings" ON meetings;
CREATE POLICY "anon_delete_meetings" ON meetings FOR DELETE
  TO anon, authenticated USING (true);

-- tasks policies (single-tenant: anon + authenticated)
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE
  TO anon, authenticated USING (true);