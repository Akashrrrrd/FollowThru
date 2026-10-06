-- Add single-use token support to team invitations
-- token_used_at: timestamp when the token was actually used to accept the invitation
-- This allows enforcing single-use tokens: a token can only be used once

ALTER TABLE public.team_invitations ADD COLUMN IF NOT EXISTS token_used_at TIMESTAMP WITH TIME ZONE;

-- Create index on token_used_at for queries checking if token has been used
CREATE INDEX IF NOT EXISTS idx_team_invitations_token_used_at ON public.team_invitations(token_used_at);

-- Add comment explaining the field
COMMENT ON COLUMN public.team_invitations.token_used_at IS 'Timestamp when this token was used to accept the invitation. NULL means the token has not been used yet. Once set, the token cannot be reused.';
