-- Phase 5: Unified Notification System
-- Creates a single notifications table to consolidate all notification types

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  commitment_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN (
    'assignment', 'reassignment', 'due_soon', 'due_1h', 'overdue',
    'escalation', 'status_change', 'completion', 'team_invitation'
  )),
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  read_at timestamptz,
  email_sent_at timestamptz,
  email_failed_at timestamptz,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can see their own notifications
DROP POLICY IF EXISTS "view_own_notifications" ON public.notifications;
CREATE POLICY "view_own_notifications" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
