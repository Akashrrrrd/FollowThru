-- Phase 4: Reminder & Escalation Engine
-- Adds tables to track reminder and escalation state for commitments

CREATE TABLE IF NOT EXISTS public.escalation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  escalated_to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  escalation_type text NOT NULL CHECK (escalation_type IN ('24h_overdue', '48h_overdue', '72h_overdue', 'manual')),
  escalation_level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'voided')),
  delivery_channel text NOT NULL DEFAULT 'email',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.escalation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  current_escalation_level integer NOT NULL DEFAULT 0,
  last_escalation_at timestamptz,
  next_escalation_due timestamptz,
  total_escalations integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_escalation_history_task_id ON public.escalation_history(task_id);
CREATE INDEX IF NOT EXISTS idx_escalation_history_organization_id ON public.escalation_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_history_status ON public.escalation_history(status);
CREATE INDEX IF NOT EXISTS idx_escalation_state_organization_id ON public.escalation_state(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_state_next_due ON public.escalation_state(next_escalation_due);

-- Enable RLS
ALTER TABLE public.escalation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_state ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "view_org_escalations" ON public.escalation_history;
CREATE POLICY "view_org_escalations" ON public.escalation_history FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "view_org_escalation_state" ON public.escalation_state;
CREATE POLICY "view_org_escalation_state" ON public.escalation_state FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );
