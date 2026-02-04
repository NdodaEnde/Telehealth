-- Add profile photo columns to profiles table
-- For storing selfie/verification photos

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_photo_path TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_photo_updated_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN profiles.profile_photo_path IS 'Storage path for profile photo (bucket/filename)';
COMMENT ON COLUMN profiles.profile_photo_updated_at IS 'Timestamp when profile photo was last updated';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_photo_path ON profiles(profile_photo_path) WHERE profile_photo_path IS NOT NULL;
