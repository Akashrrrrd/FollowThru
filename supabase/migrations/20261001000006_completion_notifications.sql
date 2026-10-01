-- Phase 4.5: Completion Notifications
-- Track responsible persons and send completion emails

CREATE TABLE IF NOT EXISTS public.commitment_responsible_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_followthru_member BOOLEAN DEFAULT FALSE,
  user_id uuid REFERENCES auth.users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.completion_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subject TEXT,
  email_body TEXT,
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.commitment_responsible_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view responsible persons for their tasks"
  ON public.commitment_responsible_persons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_responsible_persons.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert responsible persons"
  ON public.commitment_responsible_persons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = commitment_responsible_persons.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view completion notifications for their tasks"
  ON public.completion_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = completion_notifications.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert completion notifications"
  ON public.completion_notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = completion_notifications.task_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update completion notifications"
  ON public.completion_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = completion_notifications.task_id
      AND t.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_responsible_persons_task_id ON public.commitment_responsible_persons(task_id);
CREATE INDEX idx_responsible_persons_email ON public.commitment_responsible_persons(email);
CREATE INDEX idx_completion_notifications_task_id ON public.completion_notifications(task_id);
CREATE INDEX idx_completion_notifications_status ON public.completion_notifications(status);
CREATE INDEX idx_completion_notifications_sent_at ON public.completion_notifications(sent_at);
