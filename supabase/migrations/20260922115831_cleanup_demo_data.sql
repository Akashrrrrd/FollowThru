/*
# Clean up demo data and drop RLS policies before user_id migration
# 1. Delete rows with demo-user or null user_id values
# 2. Drop all RLS policies that reference user_id column
# These were from pre-auth demo phase and will be incompatible with uuid+auth.uid() defaults
# Policies must be dropped before ALTER TABLE TYPE
*/

-- Step 1: Disable RLS temporarily to allow policy dropping
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all policies on meetings and tasks tables
DO $$ 
DECLARE 
  pol RECORD;
BEGIN
  -- Drop all policies on meetings table
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'meetings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON meetings', pol.policyname);
  END LOOP;
  
  -- Drop all policies on tasks table
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'tasks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', pol.policyname);
  END LOOP;
END $$;

-- Step 3: Delete demo data from tasks first (foreign key dependency)
DELETE FROM tasks WHERE user_id IS NULL OR user_id = 'demo-user';

-- Step 4: Delete demo data from meetings
DELETE FROM meetings WHERE user_id IS NULL OR user_id = 'demo-user';

-- Step 5: Also clean up data in related tables that might reference demo-user
DELETE FROM executive_metrics WHERE user_id IS NULL OR user_id = 'demo-user';
DELETE FROM integration_clients WHERE user_id IS NULL OR user_id = 'demo-user';
DELETE FROM sync_jobs WHERE user_id IS NULL OR user_id = 'demo-user';
