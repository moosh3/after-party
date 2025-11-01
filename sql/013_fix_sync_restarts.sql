-- Fix video sync restart issues
-- This migration addresses the root causes of unexpected video restarts:
-- 1. Trigger fires on every update, not just playback changes
-- 2. playback_updated_at changes even when playback state hasn't
-- 3. No deduplication of realtime events

-- ==============================================================================
-- FIX #1: Only update playback_elapsed_ms when playback fields actually change
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_playback_elapsed()
RETURNS TRIGGER AS $$
BEGIN
  -- CRITICAL: Only process if playback-related fields are actually changing
  -- This prevents unnecessary realtime broadcasts on unrelated updates
  IF (OLD.playback_state IS DISTINCT FROM NEW.playback_state OR 
      OLD.playback_position IS DISTINCT FROM NEW.playback_position OR
      OLD.playback_id IS DISTINCT FROM NEW.playback_id) THEN
    
    -- Reset elapsed time on state change, video change, or significant position jump
    IF NEW.playback_state != OLD.playback_state OR 
       NEW.playback_id != OLD.playback_id OR
       ABS(NEW.playback_position - OLD.playback_position) > 1 THEN
      NEW.playback_elapsed_ms := 0;
      NEW.playback_updated_at := NOW();
    ELSE
      -- Track elapsed time since last update (in milliseconds)
      -- Only update if video is playing and position changed slightly
      NEW.playback_elapsed_ms := EXTRACT(EPOCH FROM (NOW() - OLD.playback_updated_at)) * 1000;
      NEW.playback_updated_at := NOW();
    END IF;
  ELSE
    -- Playback fields haven't changed - preserve existing values
    -- This is KEY to preventing false restart events
    NEW.playback_elapsed_ms := OLD.playback_elapsed_ms;
    NEW.playback_updated_at := OLD.playback_updated_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS compute_playback_elapsed ON current_stream;
CREATE TRIGGER compute_playback_elapsed
BEFORE UPDATE ON current_stream
FOR EACH ROW EXECUTE FUNCTION update_playback_elapsed();

-- ==============================================================================
-- FIX #2: Add a trigger to prevent broadcasting non-playback changes
-- ==============================================================================

CREATE OR REPLACE FUNCTION should_broadcast_playback_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only broadcast if playback-related fields actually changed
  IF (OLD.playback_state IS DISTINCT FROM NEW.playback_state OR 
      OLD.playback_position IS DISTINCT FROM NEW.playback_position OR
      OLD.playback_id IS DISTINCT FROM NEW.playback_id OR
      OLD.hold_screen_enabled IS DISTINCT FROM NEW.hold_screen_enabled OR
      OLD.show_poster IS DISTINCT FROM NEW.show_poster) THEN
    RETURN NEW;
  END IF;
  
  -- Suppress broadcast for non-playback updates
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would filter broadcasts, but Supabase realtime doesn't support
-- conditional triggers in this way. Instead, we rely on Fix #1 to prevent
-- playback_updated_at from changing unnecessarily, which will prevent broadcasts.

-- ==============================================================================
-- FIX #3: Add a column to track the last actual playback command
-- ==============================================================================

-- This helps differentiate between "admin changed something" vs "system updated metadata"
ALTER TABLE current_stream
ADD COLUMN IF NOT EXISTS last_playback_command text,
ADD COLUMN IF NOT EXISTS last_command_id text;

COMMENT ON COLUMN current_stream.last_playback_command IS 
  'The last playback command issued (play, pause, seek, restart). Used for deduplication.';

COMMENT ON COLUMN current_stream.last_command_id IS 
  'Unique ID for the last command to prevent processing the same command multiple times.';

-- ==============================================================================
-- FIX #4: Update advance_queue_next to NOT touch playback_updated_at if unnecessary
-- ==============================================================================

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

  -- FIXED: Update current stream with new video
  -- playback_updated_at and playback_elapsed_ms will be handled by the trigger
  UPDATE current_stream
  SET playback_id = mux_data.playback_id,
      title = mux_data.label,
      kind = COALESCE(mux_data.kind, 'vod'),
      updated_at = NOW(),
      updated_by = admin_user_id,
      playback_state = 'playing',  -- Changed from 'paused' to auto-play
      playback_position = 0,
      -- Removed explicit playback_updated_at and playback_elapsed_ms - trigger handles it
      auto_advance_in_progress = false,
      auto_advance_lock_at = NULL,
      hold_screen_enabled = false,
      hold_screen_resume_playback_id = NULL,
      hold_screen_resume_position = NULL,
      hold_screen_resume_state = NULL,
      last_playback_command = 'auto_advance',
      last_command_id = 'advance-' || extract(epoch from NOW())::text
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

-- ==============================================================================
-- FIX #5: Add indexes for better realtime query performance
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_current_stream_playback_state 
  ON current_stream(playback_state, playback_position);

-- ==============================================================================
-- Verification queries
-- ==============================================================================

-- Check that the trigger is properly installed
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'current_stream'::regclass 
AND tgname = 'compute_playback_elapsed';

-- Helpful comment
COMMENT ON FUNCTION update_playback_elapsed() IS 
  'Fixed version that only updates playback timestamps when playback actually changes, preventing false restart events.';

