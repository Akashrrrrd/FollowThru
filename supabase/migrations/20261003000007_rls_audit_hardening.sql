-- RLS Audit Hardening
-- Add audit logging for sensitive RLS-protected operations
-- Track who accesses what, when, and where within org/team context

-- Create audit log table if not exists
CREATE TABLE IF NOT EXISTS public.rls_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  table_name text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  record_id uuid,
  details jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for query performance
CREATE INDEX IF NOT EXISTS idx_rls_audit_log_user_org ON public.rls_audit_log(user_id, organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rls_audit_log_team ON public.rls_audit_log(team_id, created_at DESC);

-- Enable RLS on audit log
ALTER TABLE public.rls_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own audit entries
CREATE POLICY audit_log_view_own ON public.rls_audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Policy: System can insert audit entries
CREATE POLICY audit_log_insert ON public.rls_audit_log FOR INSERT
  WITH CHECK (TRUE);
