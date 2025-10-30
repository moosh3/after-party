-- Add synchronized playback state to current_stream table
ALTER TABLE current_stream 
ADD COLUMN playback_state text CHECK (playback_state IN ('playing', 'paused')) DEFAULT 'paused',
ADD COLUMN playback_position numeric DEFAULT 0, -- Current position in seconds
ADD COLUMN playback_updated_at timestamptz DEFAULT now();

-- Create index for efficient realtime updates
CREATE INDEX idx_current_stream_playback ON current_stream(playback_updated_at);

-- Update the RLS policies for current_stream if not already set
ALTER TABLE current_stream ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to current_stream" ON current_stream
  FOR SELECT USING (true);

CREATE POLICY "Allow admin to update current_stream" ON current_stream
  FOR UPDATE USING (true);

CREATE POLICY "Allow admin to insert current_stream" ON current_stream
  FOR INSERT WITH CHECK (true);

-- Initialize the current_stream row with default sync values if it doesn't exist
INSERT INTO current_stream (id, playback_id, title, kind, playback_state, playback_position)
VALUES (1, 'demo-playback-id', 'No stream configured', 'vod', 'paused', 0)
ON CONFLICT (id) DO NOTHING;

