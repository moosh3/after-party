-- Add poster mode toggle to current_stream table
-- This allows admins to toggle between showing the event poster and the registration form

ALTER TABLE current_stream
ADD COLUMN IF NOT EXISTS show_poster boolean DEFAULT false;

-- Update comment
COMMENT ON COLUMN current_stream.show_poster IS 'When true, displays event poster instead of registration form';

