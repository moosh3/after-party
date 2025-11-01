-- Create database functions for atomic queue operations
-- This ensures transaction safety for queue manipulations

-- Function to atomically advance to next video in queue
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

  -- Update current stream with new video (reset playback state)
  UPDATE current_stream
  SET playback_id = mux_data.playback_id,
      title = mux_data.label,
      kind = COALESCE(mux_data.kind, 'vod'),
      updated_at = NOW(),
      updated_by = admin_user_id,
      playback_state = 'paused',
      playback_position = 0,
      playback_updated_at = NOW(),
      auto_advance_in_progress = false,
      auto_advance_lock_at = NULL
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

-- Function to atomically reorder queue
CREATE OR REPLACE FUNCTION reorder_queue(items json, admin_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  item json;
BEGIN
  -- Update all positions in a single transaction
  FOR item IN SELECT * FROM json_array_elements(items)
  LOOP
    UPDATE video_queue
    SET position = (item->>'position')::int
    WHERE id = (item->>'id')::uuid;
  END LOOP;

  -- Log admin action
  INSERT INTO admin_actions (action_type, admin_user, details)
  VALUES ('queue_reorder', admin_user_id, json_build_object('items', items));

  RETURN json_build_object('success', true);
END;
$$;

-- Function to atomically delete from queue and reorder
CREATE OR REPLACE FUNCTION delete_from_queue(queue_item_id uuid, admin_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_position int;
  deleted_mux_id uuid;
BEGIN
  -- Get and delete the item
  DELETE FROM video_queue
  WHERE id = queue_item_id
  RETURNING position, mux_item_id INTO deleted_position, deleted_mux_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;

  -- Reorder remaining items
  UPDATE video_queue
  SET position = position - 1
  WHERE position > deleted_position;

  -- Log admin action
  INSERT INTO admin_actions (action_type, admin_user, details)
  VALUES (
    'queue_remove',
    admin_user_id,
    json_build_object(
      'queue_item_id', queue_item_id,
      'mux_item_id', deleted_mux_id,
      'old_position', deleted_position
    )
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION advance_queue_next(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reorder_queue(json, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_from_queue(uuid, text) TO authenticated, anon;

