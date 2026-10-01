-- Demo Data for Commitment Continuity Showcase
-- Demonstrates FollowThru's core differentiator: tracking commitments across meetings
-- 
-- This migration creates a clean, simple two-meeting demo journey:
-- Meeting 1: Multiple commitments made, one remains open
-- Meeting 2: Same commitment is revisited, appears as "continued/carried over"
--
-- IMPORTANT: Replace 'DEMO_USER_ID_HERE' with the actual user ID before running
-- To get your user ID:
-- 1. Sign up/login to the app
-- 2. Go to Supabase Dashboard > Authentication > Users
-- 3. Copy your user's UUID and replace 'DEMO_USER_ID_HERE' below

DO $$
DECLARE
  demo_user_id uuid := 'DEMO_USER_ID_HERE'; -- Replace with your actual user ID
  meeting1_id uuid;
  meeting2_id uuid;
  task1_id uuid;
  task2_id uuid;
  task3_id uuid;
  task4_id uuid;
  task5_id uuid;
  task6_id uuid;
BEGIN

-- Verify user exists (will error if user ID is invalid)
IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
  RAISE EXCEPTION 'User ID % does not exist. Please replace DEMO_USER_ID_HERE with your actual user ID.', demo_user_id;
END IF;

-- Meeting 1: Q4 Mobile App Launch Planning (Sept 26, 2026)
INSERT INTO meetings (user_id, title, transcript, created_at)
VALUES (
  demo_user_id,
  'Q4 Mobile App Launch - Technical Planning',
  'Priya: Alright, let''s talk about the launch timeline. We have 4 weeks to ship the mobile app update.
Vikram: I can have the database migration ready by October 8th. After that, Rahul can start the API integration.
Rahul: Sure, once Vikram finishes the migration, I''ll handle the API endpoints. I can knock that out in 3 days, so by October 11th.
Priya: Perfect. Ananya, can you work on the mobile UI components?
Ananya: I''ll have the UI components and design system updated by October 10th. But I''ll need the final API spec by October 9th at the latest.
Rahul: I''ll send you the API spec by October 9th morning.
Vikram: One more thing — I''ll also update the database documentation by end of week.
Priya: Great. We''ll schedule a final integration test meeting for October 15th to verify everything works together.',
  '2026-09-26'::timestamptz
)
RETURNING id INTO meeting1_id;

-- Meeting 1 Commitments
-- Commitment 1: Vikram's database migration (will be carried over)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting1_id,
  demo_user_id,
  'Complete database migration',
  'Vikram',
  '2026-10-08',
  'I can have the database migration ready by October 8th.',
  'open',
  'high',
  'explicit',
  '2026-09-26'::timestamptz
)
RETURNING id INTO task1_id;

-- Commitment 2: Rahul's API endpoints (depends on Vikram)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, dependency, created_at)
VALUES (
  meeting1_id,
  demo_user_id,
  'Implement API endpoints',
  'Rahul',
  '2026-10-11',
  'Sure, once Vikram finishes the migration, I''ll handle the API endpoints. I can knock that out in 3 days, so by October 11th.',
  'open',
  'high',
  'explicit',
  'Vikram finishes database migration',
  '2026-09-26'::timestamptz
);

-- Commitment 3: Ananya's UI components
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting1_id,
  demo_user_id,
  'Update UI components and design system',
  'Ananya',
  '2026-10-10',
  'I''ll have the UI components and design system updated by October 10th.',
  'open',
  'high',
  'explicit',
  '2026-09-26'::timestamptz
);

-- Commitment 4: Rahul's API spec (dependency for Ananya)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting1_id,
  demo_user_id,
  'Send final API specification',
  'Rahul',
  '2026-10-09',
  'I''ll send you the API spec by October 9th morning.',
  'open',
  'high',
  'explicit',
  '2026-09-26'::timestamptz
);

-- Commitment 5: Vikram's documentation (will complete before next meeting)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting1_id,
  demo_user_id,
  'Update database documentation',
  'Vikram',
  '2026-09-30',
  'One more thing — I''ll also update the database documentation by end of week.',
  'completed',
  'high',
  'explicit',
  '2026-09-26'::timestamptz
);

-- Commitment 6: Collective team commitment (integration test meeting)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting1_id,
  demo_user_id,
  'Schedule final integration test meeting',
  'Unassigned',
  '2026-10-15',
  'Great. We''ll schedule a final integration test meeting for October 15th to verify everything works together.',
  'open',
  'medium',
  'collective',
  '2026-09-26'::timestamptz
);

-- Meeting 2: Follow-up status check (Sept 29, 2026 — 3 days later)
INSERT INTO meetings (user_id, title, transcript, created_at)
VALUES (
  demo_user_id,
  'Q4 Mobile App Launch - Status Check',
  'Priya: Let''s do a quick status check. How are we looking?
Vikram: Database migration is on track. I finished the documentation like I planned, and the migration is 80% done. Still targeting October 8th.
Rahul: Good news — I already sent the API spec to Ananya. I can start the implementation right after Vikram finishes the migration on the 8th, so October 11th is still realistic.
Ananya: Thanks Rahul! I have the spec now. The UI components are looking good. I''m still on target for October 10th.
Priya: Excellent. We''re all aligned. Let''s confirm the database migration is still on track for October 8th and we can proceed.',
  '2026-09-29'::timestamptz
)
RETURNING id INTO meeting2_id;

-- Meeting 2 Commitments
-- These will be matched to Meeting 1 commitments via Commitment Continuity logic

-- Commitment A: Vikram's ongoing database migration (carries over from Meeting 1)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting2_id,
  demo_user_id,
  'Complete database migration',
  'Vikram',
  '2026-10-08',
  'Database migration is on track. I finished the documentation like I planned, and the migration is 80% done. Still targeting October 8th.',
  'in_progress',
  'high',
  'explicit',
  '2026-09-29'::timestamptz
);

-- Commitment B: Rahul's API implementation status update
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, dependency, created_at)
VALUES (
  meeting2_id,
  demo_user_id,
  'Implement API endpoints',
  'Rahul',
  '2026-10-11',
  'I can start the implementation right after Vikram finishes the migration on the 8th, so October 11th is still realistic.',
  'open',
  'high',
  'explicit',
  'Vikram finishes database migration',
  '2026-09-29'::timestamptz
);

-- Commitment C: Ananya's UI components (updated status)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, confidence, commitment_type, created_at)
VALUES (
  meeting2_id,
  demo_user_id,
  'Update UI components and design system',
  'Ananya',
  '2026-10-10',
  'The UI components are looking good. I''m still on target for October 10th.',
  'in_progress',
  'high',
  'explicit',
  '2026-09-29'::timestamptz
);

END $$;

-- Summary:
-- Meeting 1 (Sept 26): 6 commitments
--   - 1 Completed (Vikram: documentation)
--   - 5 Open (Vikram: migration, Rahul: API endpoints + spec, Ananya: UI, Team: integration test)
--
-- Meeting 2 (Sept 29): 3 new tasks that will be continuity-linked
--   - Vikram's migration: carries over (same owner, same description, same date)
--   - Rahul's API implementation: carries over (same owner, same description, same date, same dependency)
--   - Ananya's UI: carries over (same owner, same description, same date)
--
-- This demonstrates Commitment Continuity:
-- Same commitments appear in both meetings with linked history, not duplicates
