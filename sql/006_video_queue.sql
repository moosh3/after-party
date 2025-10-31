-- Video Queue System
-- Allows admins to queue up videos for sequential playback with auto-advance
-- No limit on queue size - add as many videos as needed

-- Video queue table
CREATE TABLE video_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mux_item_id uuid REFERENCES mux_items(id) ON DELETE CASCADE,
  position int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (position)
);

-- Index for efficient ordered retrieval
CREATE INDEX idx_video_queue_position ON video_queue(position);

-- Add auto-advance feature to current_stream
ALTER TABLE current_stream
ADD COLUMN IF NOT EXISTS auto_advance_enabled boolean DEFAULT false;

-- Comment for documentation
COMMENT ON TABLE video_queue IS 'Ordered queue of videos for sequential playback';
COMMENT ON COLUMN video_queue.position IS 'Order of video in queue (1-based, sequential)';
COMMENT ON COLUMN current_stream.auto_advance_enabled IS 'When true, automatically advances to next video in queue when current video ends';

-- Enable RLS for video_queue
ALTER TABLE video_queue ENABLE ROW LEVEL SECURITY;

-- Allow read access to all (viewers can see the queue)
CREATE POLICY "Allow read access to video_queue" ON video_queue
  FOR SELECT USING (true);

-- Only admins can modify queue (enforced at API level)
CREATE POLICY "Allow admin to insert video_queue" ON video_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin to update video_queue" ON video_queue
  FOR UPDATE USING (true);

CREATE POLICY "Allow admin to delete video_queue" ON video_queue
  FOR DELETE USING (true);

