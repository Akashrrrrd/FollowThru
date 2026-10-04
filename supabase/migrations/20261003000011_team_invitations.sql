-- Team invitations
-- Fixes vs. previous version:
--  * invited_by was NOT NULL + ON DELETE SET NULL (contradiction) -> now nullable
--  * SELECT policy let every org member read invitation tokens -> managers only
--  * update_updated_at_column() is created here so the trigger can't fail
--  * partial unique index prevents duplicate pending invites per team+email

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('team_lead', 'member')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- token already has a unique index via UNIQUE constraint
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON public.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_organization_id ON public.team_invitations(organization_id);

-- Only one live pending invitation per team + email
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invitations_pending
  ON public.team_invitations(team_id, email)
  WHERE status = 'pending';

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view team invitations for their organization" ON public.team_invitations;
DROP POLICY IF EXISTS "Only managers can create team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Invited managers can update invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Managers can view team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Managers can update team invitations" ON public.team_invitations;

-- Tokens are secrets: only owners/managers may read rows directly.
-- (The API uses the service-role client, which bypasses RLS.)
CREATE POLICY "Managers can view team invitations"
  ON public.team_invitations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Only managers can create team invitations"
  ON public.team_invitations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "Managers can update team invitations"
  ON public.team_invitations
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
    )
  );

DROP TRIGGER IF EXISTS update_team_invitations_updated_at ON public.team_invitations;
CREATE TRIGGER update_team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();