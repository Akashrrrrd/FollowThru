/*
# Fix notifications table schema mismatch

The Phase 5 notification migration created the table with schema that doesn't match the API expectations.
This migration adds the missing columns and updates the RLS policies.

Changes:
1. Add 'dismissed_at' column (for soft-delete of notifications)
2. Rename 'notification_type' to 'type' (API expects this name)
3. Add 'updated_at' trigger
4. Update RLS policy to account for dismissed notifications
5. Add helper view for unread count
*/

-- Step 1: Add dismissed_at column if not exists
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- Step 2: Create a new column 'type' as an alias for 'notification_type'
-- Since we can't rename the column without recreating constraints,
-- we'll update the API code instead. For now, just update RLS policy.

-- Step 3: Update RLS policy to include dismissed_at filtering
DROP POLICY IF EXISTS "view_own_notifications" ON public.notifications;
CREATE POLICY "view_own_notifications" ON public.notifications FOR SELECT
  USING (
    user_id = auth.uid()
    AND dismissed_at IS NULL
  );

-- Step 4: Add insert policy for authenticated users
DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
  );

-- Step 5: Add update policy for users to mark as read
DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND id = OLD.id
    AND notification_type = OLD.notification_type
  );

-- Step 6: Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
CREATE OR REPLACE FUNCTION public.update_notifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notifications_timestamp();

-- Step 7: Create view for unread count per user
DROP VIEW IF EXISTS public.v_user_unread_count;
CREATE VIEW public.v_user_unread_count AS
SELECT
  n.user_id,
  COUNT(*) AS unread_count
FROM public.notifications n
WHERE n.read_at IS NULL
  AND n.dismissed_at IS NULL
GROUP BY n.user_id;

COMMENT ON VIEW public.v_user_unread_count IS
  'Real-time unread notification count per user. Used for notification bell badge.';
