-- Migration to add Google OAuth support to users table
-- Run this in your Supabase SQL Editor

-- Add new columns for OAuth
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Make password_hash nullable for OAuth users
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

-- Add index for google_id
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Add index for provider
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

COMMENT ON COLUMN users.google_id IS 'Google OAuth user ID';
COMMENT ON COLUMN users.provider IS 'Authentication provider: email, google';
COMMENT ON COLUMN users.avatar_url IS 'User profile picture URL from OAuth provider';
