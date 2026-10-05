-- Create users/profiles table to store user identity information
-- Links to Supabase auth.users via UUID foreign key

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Required identity fields
  full_name varchar(255) NOT NULL DEFAULT '',
  display_name varchar(100) NOT NULL DEFAULT '',
  
  -- Optional fields
  job_title varchar(255),
  avatar_url text,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users can view their own profile
CREATE POLICY "view_own_profile" 
  ON user_profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Policy 2: INSERT - Server/client can insert for users
CREATE POLICY "insert_profile" 
  ON user_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Policy 3: UPDATE - Users can update their own profile
CREATE POLICY "update_own_profile" 
  ON user_profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Policy 4: DELETE - Users can delete their own profile
CREATE POLICY "delete_own_profile" 
  ON user_profiles 
  FOR DELETE 
  USING (auth.uid() = id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at (drop first to ensure idempotency)
DROP TRIGGER IF EXISTS user_profiles_updated_at_trigger ON user_profiles;
CREATE TRIGGER user_profiles_updated_at_trigger
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_updated_at();

-- Create index on display_name for participant matching
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);

-- Add comment for clarity
COMMENT ON TABLE user_profiles IS 'User identity and profile information. Extends Supabase auth.users with application-specific profile data.';
COMMENT ON COLUMN user_profiles.display_name IS 'Display name used in meetings to identify the user (e.g., "Akash" from full name "Akash R")';
COMMENT ON COLUMN user_profiles.full_name IS 'Full name of the user for display and participant matching';
