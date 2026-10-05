/*
# Enable Realtime for Phase 2 Team Context
# Publish tables needed for live team/task/notification updates

Publishing strategy:
- Public tables available to all org members via RLS
- Clients subscribe to specific tables and filter by team/org in real-time handlers
- API layer continues to enforce RLS on modifications
*/

-- ============================================================================
-- PART 1: SET REPLICA IDENTITY FOR OPTIMAL REALTIME
-- ============================================================================

-- Set REPLICA IDENTITY FULL for tables that need UPDATE/DELETE detection
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.team_members REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.completion_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.task_blockers REPLICA IDENTITY FULL;

-- Keep DEFAULT for append-only or insert-heavy tables (still works, just less efficient for updates)
-- commitment_responsible_persons - mostly insert, rarely updated
-- commitment_continuity_events - append-only

-- ============================================================================
-- PART 2: ADD TABLES TO REALTIME PUBLICATION
-- ============================================================================

-- Add core tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_blockers;

-- Add notification tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.completion_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commitment_responsible_persons;

-- Optional: Add for analytics dashboards (lower priority)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.decision_revisits;

-- Note: Do NOT add executive_metrics (computed read-only) or 
-- commitment_continuity_events (append-only audit trail) to realtime

-- ============================================================================
-- PART 3: VERIFICATION
-- ============================================================================

-- Verify publications
-- Run this to check which tables are now published:
-- SELECT schemaname, tablename FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- END MIGRATION
-- ============================================================================
