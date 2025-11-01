-- Add elapsed time tracking to fix clock skew issues
-- This allows the server to calculate elapsed time since last update,
-- eliminating dependency on client clock synchronization

-- Add column for tracking elapsed milliseconds
ALTER TABLE current_stream 
ADD COLUMN IF NOT EXISTS playback_elapsed_ms integer DEFAULT 0;

-- Create function to automatically compute elapsed time
CREATE OR REPLACE FUNCTION update_playback_elapsed()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset elapsed time on state change or significant position jump
  IF NEW.playback_state != OLD.playback_state OR 
     ABS(NEW.playback_position - OLD.playback_position) > 1 THEN
    NEW.playback_elapsed_ms := 0;
  ELSE
    -- Track elapsed time since last update (in milliseconds)
    NEW.playback_elapsed_ms := EXTRACT(EPOCH FROM (NOW() - OLD.playback_updated_at)) * 1000;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to compute elapsed time before each update
DROP TRIGGER IF EXISTS compute_playback_elapsed ON current_stream;
CREATE TRIGGER compute_playback_elapsed
BEFORE UPDATE ON current_stream
FOR EACH ROW EXECUTE FUNCTION update_playback_elapsed();

-- Initialize the column for existing row
UPDATE current_stream SET playback_elapsed_ms = 0 WHERE id = 1;

-- Add helpful comment
COMMENT ON COLUMN current_stream.playback_elapsed_ms IS 
'Milliseconds elapsed since last playback state update. Used to compensate for network latency without client clock dependencies.';

