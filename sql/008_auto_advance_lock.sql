-- Add auto-advance lock to prevent concurrent auto-advance operations
-- This prevents race conditions when multiple admin tabs try to advance simultaneously

ALTER TABLE current_stream
ADD COLUMN IF NOT EXISTS auto_advance_in_progress boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_advance_lock_at timestamptz;

-- Comment for documentation
COMMENT ON COLUMN current_stream.auto_advance_in_progress IS 'Lock flag to prevent concurrent auto-advance operations';
COMMENT ON COLUMN current_stream.auto_advance_lock_at IS 'Timestamp when auto-advance lock was acquired (for detecting stale locks)';

