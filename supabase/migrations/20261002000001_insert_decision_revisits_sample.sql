-- Insert sample decision_revisits data for testing executive dashboard
-- Replace 'YOUR_USER_ID_HERE' with actual user ID

DO $$
DECLARE
  target_user_id uuid := '6287ed99-eccf-4afd-a9ba-a87de0dc7d3f'; -- REPLACE WITH YOUR USER ID
  task_id_1 uuid;
  task_id_2 uuid;
  task_id_3 uuid;
  task_id_4 uuid;
  task_id_5 uuid;
  meeting_id_1 uuid;
  meeting_id_2 uuid;
BEGIN

-- Get first 5 tasks for this user
SELECT id INTO task_id_1 FROM tasks WHERE user_id = target_user_id LIMIT 1;
SELECT id INTO task_id_2 FROM tasks WHERE user_id = target_user_id OFFSET 1 LIMIT 1;
SELECT id INTO task_id_3 FROM tasks WHERE user_id = target_user_id OFFSET 2 LIMIT 1;
SELECT id INTO task_id_4 FROM tasks WHERE user_id = target_user_id OFFSET 3 LIMIT 1;
SELECT id INTO task_id_5 FROM tasks WHERE user_id = target_user_id OFFSET 4 LIMIT 1;

-- Get a meeting ID
SELECT id INTO meeting_id_1 FROM meetings WHERE user_id = target_user_id LIMIT 1;
SELECT id INTO meeting_id_2 FROM meetings WHERE user_id = target_user_id OFFSET 1 LIMIT 1;

-- Ensure we have data before inserting
IF task_id_1 IS NOT NULL AND meeting_id_1 IS NOT NULL THEN
  
  -- Insert decision_revisits records
  INSERT INTO decision_revisits (task_id, meeting_id, revisit_count, reschedule_count, scope_changes, last_revisited, created_at)
  VALUES 
    (task_id_1, meeting_id_1, 3, 2, 1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    (task_id_2, COALESCE(meeting_id_2, meeting_id_1), 2, 1, 0, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (task_id_3, meeting_id_1, 2, 1, 1, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (task_id_4, COALESCE(meeting_id_2, meeting_id_1), 1, 0, 0, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    (task_id_5, meeting_id_1, 1, 1, 0, NOW(), NOW())
  ON CONFLICT DO NOTHING;

END IF;

END $$;
