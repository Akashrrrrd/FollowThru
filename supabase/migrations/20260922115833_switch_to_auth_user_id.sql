/*
# Switch meetings and tasks to authenticated user_id

1. Modified Tables
- `meetings`: change user_id from text default 'demo-user' to uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- `tasks`: change user_id from text default 'demo-user' to uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE

2. Security Changes
- Drop all existing anon-accessible policies on both tables
- Create new authenticated-only, owner-scoped RLS policies (SELECT/INSERT/UPDATE/DELETE)
- Each policy checks auth.uid() = user_id
- INSERT policies use WITH CHECK (auth.uid() = user_id) so the DEFAULT auth.uid() fills the owner automatically
- For tasks, INSERT also validates the parent meeting belongs to the same user via EXISTS subquery

3. Important Notes
- Existing rows with user_id='demo-user' will be deleted since the column type changes from text to uuid
  (acceptable: this is a pre-auth demo state, no production data to preserve)
- The DEFAULT auth.uid() means frontend inserts that omit user_id will still satisfy RLS
- auth.users is the built-in Supabase auth table
*/

-- Migrate meetings.user_id to uuid
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_user_id_fkey;
ALTER TABLE meetings ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE meetings ALTER COLUMN user_id TYPE uuid USING NULL;
ALTER TABLE meetings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE meetings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE meetings ADD CONSTRAINT meetings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrate tasks.user_id to uuid
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE tasks ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN user_id TYPE uuid USING NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old anon policies on meetings
DROP POLICY IF EXISTS "anon_select_meetings" ON meetings;
DROP POLICY IF EXISTS "anon_insert_meetings" ON meetings;
DROP POLICY IF EXISTS "anon_update_meetings" ON meetings;
DROP POLICY IF EXISTS "anon_delete_meetings" ON meetings;

-- Drop old anon policies on tasks
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;

-- New authenticated-only policies for meetings
DROP POLICY IF EXISTS "select_own_meetings" ON meetings;
CREATE POLICY "select_own_meetings" ON meetings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_meetings" ON meetings;
CREATE POLICY "insert_own_meetings" ON meetings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_meetings" ON meetings;
CREATE POLICY "update_own_meetings" ON meetings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_meetings" ON meetings;
CREATE POLICY "delete_own_meetings" ON meetings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- New authenticated-only policies for tasks
DROP POLICY IF EXISTS "select_own_tasks" ON tasks;
CREATE POLICY "select_own_tasks" ON tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tasks" ON tasks;
CREATE POLICY "insert_own_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = tasks.meeting_id
      AND meetings.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_tasks" ON tasks;
CREATE POLICY "update_own_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tasks" ON tasks;
CREATE POLICY "delete_own_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);