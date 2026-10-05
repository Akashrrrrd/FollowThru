-- Phase 5: Extended user preferences for notification controls
-- Adds granular notification preferences for in-app and email delivery
-- By notification type: assignment, due_soon, due_1h, overdue, escalation, status_change, completion

BEGIN;

-- Add notification preference columns to user_preferences table
-- Email notification toggles per type
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_assignment BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_due_soon BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_due_1h BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_overdue BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_escalation BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_status_change BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_notifications_completion BOOLEAN DEFAULT TRUE;

-- In-app notification toggles per type
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_assignment BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_due_soon BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_due_1h BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_overdue BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_escalation BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_status_change BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS inapp_notifications_completion BOOLEAN DEFAULT TRUE;

-- Email digest preferences
-- daily_digest_enabled: If true, sends one email per day with all notifications instead of individual emails
-- daily_digest_time: Time of day to send digest (e.g., '09:00', defaults to '09:00')
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS email_digest_time TEXT DEFAULT '09:00' CHECK (email_digest_time ~ '^\d{2}:\d{2}$');

-- Global notification settings
-- notifications_enabled: Master toggle for all notifications
-- quiet_hours_start: Start time for quiet hours (e.g., '22:00', no notifications sent during quiet hours)
-- quiet_hours_end: End time for quiet hours (e.g., '08:00')
-- quiet_hours_enabled: Whether to enforce quiet hours
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00' CHECK (quiet_hours_start ~ '^\d{2}:\d{2}$');
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '08:00' CHECK (quiet_hours_end ~ '^\d{2}:\d{2}$');

-- Rebuild updated_at trigger to work with new columns
-- (This will be automatically handled by existing trigger)

COMMIT;
