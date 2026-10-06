-- Enable Realtime on tasks table for real-time assignment updates
-- This allows subscriptions to task changes via Supabase Realtime

-- Enable publication for tasks table (if not already enabled)
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
CREATE PUBLICATION supabase_realtime FOR TABLE public.tasks;

-- Enable realtime on tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Alternative: enable realtime for all relevant tables used in subscriptions
-- This allows more efficient broadcasting of updates
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.meetings;

-- Note: RLS policies are automatically applied to realtime subscriptions,
-- so users will only see updates for tasks they have access to.
