-- Add user_name column to poll_votes table
-- This allows admins to see who voted for what once polls close

-- Add user_name column to track voter display names
ALTER TABLE poll_votes
ADD COLUMN user_name TEXT NOT NULL DEFAULT 'Anonymous';

-- Remove the default for future inserts
ALTER TABLE poll_votes
ALTER COLUMN user_name DROP DEFAULT;

-- Create index for efficient lookups by user_name
CREATE INDEX idx_poll_votes_user_name ON poll_votes(user_name);

