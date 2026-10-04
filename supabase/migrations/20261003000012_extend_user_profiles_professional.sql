-- Add professional and contact fields to user_profiles table
-- Phase 5: Enhanced Sign Up with Professional Profile Information
-- All new columns are nullable for backward compatibility with existing users

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email varchar(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS company varchar(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location varchar(255);

COMMENT ON COLUMN user_profiles.phone IS 'User phone number for contact purposes';
COMMENT ON COLUMN user_profiles.email IS 'User email address (optional, can differ from auth email)';
COMMENT ON COLUMN user_profiles.company IS 'Company name where user works';
COMMENT ON COLUMN user_profiles.bio IS 'User biography or professional summary';
COMMENT ON COLUMN user_profiles.location IS 'User location or office location';

CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON user_profiles(company);
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON user_profiles(location);

-- IMPORTANT: make PostgREST (Supabase API) pick up the new columns immediately.
-- Without this you can get: "Could not find the 'phone' column of 'user_profiles' in the schema cache"
NOTIFY pgrst, 'reload schema';