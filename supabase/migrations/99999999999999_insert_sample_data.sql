-- Insert Sample Data for FollowThru
-- Run this in Supabase SQL Editor after signing up as a user

-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with your actual user ID
-- To get your user ID:
-- 1. Sign up/login to your app
-- 2. In Supabase Dashboard, go to Authentication > Users
-- 3. Copy your user's UUID
-- 4. Replace 'YOUR_USER_ID_HERE' with that UUID in the query below

DO $$
DECLARE
  target_user_id uuid := '6287ed99-eccf-4afd-a9ba-a87de0dc7d3f'; -- REPLACE THIS WITH YOUR ACTUAL USER ID
  meeting1_id uuid;
  meeting2_id uuid;
  meeting3_id uuid;
BEGIN

-- Insert Meeting 1: Team Sprint Planning
INSERT INTO meetings (id, user_id, title, transcript, created_at)
VALUES (
  gen_random_uuid(),
  target_user_id,
  'Team Sprint Planning - Sept 28',
  'Sarah: Let''s review the sprint goals. John, can you finish the API documentation by Friday?
John: Yes, I''ll have the API docs complete by Friday, September 29th.
Sarah: Perfect. Mike, what about the database migration?
Mike: I''ll complete the database migration by next Tuesday.
Sarah: Great. I''ll schedule the client demo for next week Wednesday.
John: I should also mention - I''ll update the test coverage report by Monday.',
  NOW() - INTERVAL '2 days'
)
RETURNING id INTO meeting1_id;

-- Insert tasks for Meeting 1
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, created_at) VALUES
(meeting1_id, target_user_id, 'Complete API documentation', 'John', CURRENT_DATE + INTERVAL '1 day', 'Yes, I''ll have the API docs complete by Friday, September 29th.', 'open', NOW() - INTERVAL '2 days'),
(meeting1_id, target_user_id, 'Complete database migration', 'Mike', CURRENT_DATE + INTERVAL '4 days', 'I''ll complete the database migration by next Tuesday.', 'open', NOW() - INTERVAL '2 days'),
(meeting1_id, target_user_id, 'Schedule client demo', 'Sarah', CURRENT_DATE + INTERVAL '5 days', 'I''ll schedule the client demo for next week Wednesday.', 'done', NOW() - INTERVAL '2 days'),
(meeting1_id, target_user_id, 'Update test coverage report', 'John', CURRENT_DATE + INTERVAL '3 days', 'I should also mention - I''ll update the test coverage report by Monday.', 'open', NOW() - INTERVAL '2 days');

-- Insert Meeting 2: Q4 Product Launch
INSERT INTO meetings (id, user_id, title, transcript, created_at)
VALUES (
  gen_random_uuid(),
  target_user_id,
  'Q4 Product Launch Planning',
  'Alex: Welcome everyone. Let''s kick off the Q4 product launch planning.
Jordan: I''ll finalize the marketing copy by October 5th.
Alex: Thanks Jordan. Sam, how about the landing page?
Sam: I can have the landing page design ready by this Thursday.
Alex: Excellent. Taylor, can you handle the email campaign?
Taylor: Sure, I''ll set up the email campaign by October 10th.
Alex: I''ll coordinate with sales and send them the product brief by tomorrow.
Sam: One more thing - I''ll also create the social media assets by next Friday.',
  NOW() - INTERVAL '1 day'
)
RETURNING id INTO meeting2_id;

-- Insert tasks for Meeting 2
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, created_at) VALUES
(meeting2_id, target_user_id, 'Finalize marketing copy', 'Jordan', CURRENT_DATE + INTERVAL '7 days', 'I''ll finalize the marketing copy by October 5th.', 'open', NOW() - INTERVAL '1 day'),
(meeting2_id, target_user_id, 'Complete landing page design', 'Sam', CURRENT_DATE + INTERVAL '2 days', 'I can have the landing page design ready by this Thursday.', 'open', NOW() - INTERVAL '1 day'),
(meeting2_id, target_user_id, 'Set up email campaign', 'Taylor', CURRENT_DATE + INTERVAL '12 days', 'Sure, I''ll set up the email campaign by October 10th.', 'open', NOW() - INTERVAL '1 day'),
(meeting2_id, target_user_id, 'Send product brief to sales', 'Alex', CURRENT_DATE + INTERVAL '1 day', 'I''ll coordinate with sales and send them the product brief by tomorrow.', 'done', NOW() - INTERVAL '1 day'),
(meeting2_id, target_user_id, 'Create social media assets', 'Sam', CURRENT_DATE + INTERVAL '6 days', 'I''ll also create the social media assets by next Friday.', 'open', NOW() - INTERVAL '1 day');

-- Insert Meeting 3: Client Project Kickoff (with some overdue tasks)
INSERT INTO meetings (id, user_id, title, transcript, created_at)
VALUES (
  gen_random_uuid(),
  target_user_id,
  'Client Project Kickoff',
  'Emily: Thanks for joining this kickoff meeting. Let''s align on deliverables.
David: I''ll send the project timeline to everyone by end of day today.
Emily: Perfect. Lisa, what''s your plan for the requirements gathering?
Lisa: I''ll complete all stakeholder interviews by October 15th.
Emily: Great. Marcus, can you handle the technical architecture?
Marcus: Yes, I''ll have the architecture diagram ready by October 8th.
Lisa: I''ll also prepare the user research summary by this Friday.
Emily: I''ll schedule our next checkpoint meeting for October 12th.
Marcus: And I''ll set up the development environment by Monday, October 2nd.
David: I should add - I''ll finalize the budget breakdown by Thursday.',
  NOW() - INTERVAL '5 days'
)
RETURNING id INTO meeting3_id;

-- Insert tasks for Meeting 3 (including some overdue)
INSERT INTO tasks (meeting_id, user_id, description, owner, due_date, source_quote, status, created_at) VALUES
(meeting3_id, target_user_id, 'Send project timeline', 'David', CURRENT_DATE - INTERVAL '4 days', 'I''ll send the project timeline to everyone by end of day today.', 'overdue', NOW() - INTERVAL '5 days'),
(meeting3_id, target_user_id, 'Complete stakeholder interviews', 'Lisa', CURRENT_DATE + INTERVAL '17 days', 'I''ll complete all stakeholder interviews by October 15th.', 'open', NOW() - INTERVAL '5 days'),
(meeting3_id, target_user_id, 'Create architecture diagram', 'Marcus', CURRENT_DATE + INTERVAL '10 days', 'Yes, I''ll have the architecture diagram ready by October 8th.', 'open', NOW() - INTERVAL '5 days'),
(meeting3_id, target_user_id, 'Prepare user research summary', 'Lisa', CURRENT_DATE - INTERVAL '2 days', 'I''ll also prepare the user research summary by this Friday.', 'overdue', NOW() - INTERVAL '5 days'),
(meeting3_id, target_user_id, 'Schedule checkpoint meeting', 'Emily', CURRENT_DATE + INTERVAL '14 days', 'I''ll schedule our next checkpoint meeting for October 12th.', 'open', NOW() - INTERVAL '5 days'),
(meeting3_id, target_user_id, 'Set up development environment', 'Marcus', CURRENT_DATE - INTERVAL '1 day', 'And I''ll set up the development environment by Monday, October 2nd.', 'overdue', NOW() - INTERVAL '5 days'),
(meeting3_id, target_user_id, 'Finalize budget breakdown', 'David', CURRENT_DATE - INTERVAL '3 days', 'I should add - I''ll finalize the budget breakdown by Thursday.', 'overdue', NOW() - INTERVAL '5 days');

END $$;

-- Summary of inserted data:
-- 3 meetings with 16 total tasks
-- Meeting 1: 4 tasks (3 open, 1 done)
-- Meeting 2: 5 tasks (4 open, 1 done)
-- Meeting 3: 7 tasks (3 open, 4 overdue)
-- Owners: John, Sarah, Mike, Jordan, Sam, Taylor, Alex, Emily, David, Lisa, Marcus
