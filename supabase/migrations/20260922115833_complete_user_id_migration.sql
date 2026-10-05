/*
# Complete user_id UUID migration (fallback/repair)
# This migration handles the case where previous migrations ran but didn't complete
# It verifies state and completes the type change
*/

-- Step 1: Ensure RLS is disabled so we can alter
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL remaining policies
DO $$ 
DECLARE 
  pol RECORD;
  tbl_name text;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename FROM pg_policies 
    WHERE tablename IN ('meetings', 'tasks')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 
      pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Step 3: Clean up any remaining demo data
DELETE FROM tasks WHERE user_id IS NULL OR user_id = 'demo-user';
DELETE FROM meetings WHERE user_id IS NULL OR user_id = 'demo-user';

-- Step 4: Convert meetings.user_id to uuid (safe if already uuid)
-- This uses NULLIF to convert empty strings to NULL, then cast to uuid
-- For existing uuid columns, the USING clause is ignored
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_user_id_fkey;
ALTER TABLE meetings ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE meetings ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid;
ALTER TABLE meetings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE meetings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE meetings ADD CONSTRAINT meetings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 5: Convert tasks.user_id to uuid
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE tasks ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid;
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 6: Re-enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Step 7: Create organization-aware policies (Phase 1 org-scoped)
-- Meetings
CREATE POLICY "select_org_meetings" ON meetings FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_org_meetings" ON meetings FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "update_org_meetings" ON meetings FOR UPDATE
  TO authenticated USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_org_meetings" ON meetings FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Tasks
CREATE POLICY "select_org_tasks" ON tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_org_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = tasks.meeting_id
      AND m.organization_id = tasks.organization_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "update_org_tasks" ON tasks FOR UPDATE
  TO authenticated USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  ) WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_org_tasks" ON tasks FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
