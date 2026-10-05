-- Phase 4: Integration Strategy
-- OAuth clients, sync engine, nudges, meeting bots

CREATE TABLE IF NOT EXISTS public.integration_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  items_synced INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  channel TEXT DEFAULT 'email',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.meeting_bot_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  webhook_id TEXT,
  bot_user_id TEXT,
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.integration_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_bot_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their integration clients" ON public.integration_clients;
CREATE POLICY "Users can view their integration clients"
  ON public.integration_clients FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert integration clients" ON public.integration_clients;
CREATE POLICY "Users can insert integration clients"
  ON public.integration_clients FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their sync jobs" ON public.sync_jobs;
CREATE POLICY "Users can view their sync jobs"
  ON public.sync_jobs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their nudges" ON public.nudges;
CREATE POLICY "Users can view their nudges"
  ON public.nudges FOR SELECT
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_clients_user_id ON public.integration_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_clients_provider ON public.integration_clients(provider);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id ON public.sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_nudges_task_id ON public.nudges(task_id);
CREATE INDEX IF NOT EXISTS idx_nudges_user_id ON public.nudges(user_id);
CREATE INDEX IF NOT EXISTS idx_nudges_sent_at ON public.nudges(sent_at);
CREATE INDEX IF NOT EXISTS idx_meeting_bot_meeting_id ON public.meeting_bot_interactions(meeting_id);
