-- Stream resume and auto-play improvements

-- Store playback state to restore after disabling hold screen
ALTER TABLE current_stream
ADD COLUMN IF NOT EXISTS hold_screen_resume_playback_id text,
ADD COLUMN IF NOT EXISTS hold_screen_resume_position numeric,
ADD COLUMN IF NOT EXISTS hold_screen_resume_state text CHECK (hold_screen_resume_state IN ('playing', 'paused'));

COMMENT ON COLUMN current_stream.hold_screen_resume_playback_id IS 'Previous playback_id before hold screen was enabled';
COMMENT ON COLUMN current_stream.hold_screen_resume_position IS 'Previous playback position before hold screen was enabled';
COMMENT ON COLUMN current_stream.hold_screen_resume_state IS 'Previous playback state before hold screen was enabled';

-- Auto-play the next video when advancing the queue
CREATE OR REPLACE FUNCTION advance_queue_next(admin_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  next_item record;
  mux_data record;
  result json;
BEGIN
  -- Check for existing lock (prevent concurrent operations)
  IF (SELECT auto_advance_in_progress FROM current_stream WHERE id = 1) = true THEN
    -- Check if lock is stale (older than 30 seconds)
    IF (SELECT auto_advance_lock_at FROM current_stream WHERE id = 1) > (NOW() - INTERVAL '30 seconds') THEN
      RAISE EXCEPTION 'Auto-advance operation already in progress';
    END IF;
  END IF;

  -- Acquire lock
  UPDATE current_stream 
  SET auto_advance_in_progress = true, 
      auto_advance_lock_at = NOW()
  WHERE id = 1;

  -- Get the first item in queue
  SELECT id, position, mux_item_id
  INTO next_item
  FROM video_queue
  ORDER BY position ASC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Release lock
    UPDATE current_stream 
    SET auto_advance_in_progress = false, 
        auto_advance_lock_at = NULL
    WHERE id = 1;
    
    RAISE EXCEPTION 'No videos in queue';
  END IF;

  -- Get mux item data
  SELECT playback_id, label, kind
  INTO mux_data
  FROM mux_items
  WHERE id = next_item.mux_item_id;

  IF NOT FOUND THEN
    -- Release lock
    UPDATE current_stream 
    SET auto_advance_in_progress = false, 
        auto_advance_lock_at = NULL
    WHERE id = 1;
    
    RAISE EXCEPTION 'Invalid queue item data';
  END IF;

  -- Update current stream with new video (reset playback state AND disable hold screen)
  UPDATE current_stream
  SET playback_id = mux_data.playback_id,
      title = mux_data.label,
      kind = COALESCE(mux_data.kind, 'vod'),
      updated_at = NOW(),
      updated_by = admin_user_id,
      playback_state = 'playing',
      playback_position = 0,
      playback_updated_at = NOW(),
      playback_elapsed_ms = 0,
      auto_advance_in_progress = false,
      auto_advance_lock_at = NULL,
      hold_screen_enabled = false,
      hold_screen_resume_playback_id = NULL,
      hold_screen_resume_position = NULL,
      hold_screen_resume_state = NULL
  WHERE id = 1;

  -- Delete the item from queue
  DELETE FROM video_queue WHERE id = next_item.id;

  -- Reorder remaining items (shift all down by 1)
  UPDATE video_queue
  SET position = position - 1
  WHERE position > next_item.position;

  -- Log admin action
  INSERT INTO admin_actions (action_type, admin_user, details)
  VALUES (
    'queue_advance',
    admin_user_id,
    json_build_object(
      'to_playback_id', mux_data.playback_id,
      'to_title', mux_data.label
    )
  );

  -- Return result
  result := json_build_object(
    'success', true,
    'playback_id', mux_data.playback_id,
    'title', mux_data.label,
    'kind', mux_data.kind
  );

  RETURN result;
END;
$$;

