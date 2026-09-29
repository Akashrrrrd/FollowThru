-- Add owner_user_id to tasks table to track who actually owns each commitment
-- This stores the Supabase user_id of the commitment owner, separate from owner (display name)
-- Allows reliable identification even if owner name changes

ALTER TABLE tasks
ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;

-- Create index for efficient queries on owner_user_id
CREATE INDEX idx_tasks_owner_user_id ON tasks(owner_user_id);

-- Create index for finding a user's tasks
CREATE INDEX idx_tasks_user_id_owner_user_id ON tasks(user_id, owner_user_id);

-- Add comment for clarity
COMMENT ON COLUMN tasks.owner_user_id IS 'UUID of the authenticated user who owns this commitment. NULL for external participants. Used to identify "my commitments" and ensure accurate ownership tracking independent of display name changes.';
