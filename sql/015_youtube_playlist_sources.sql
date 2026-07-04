-- Add media source metadata for YouTube playlist loop support.
-- Existing Mux rows remain source_type = 'mux'.

ALTER TABLE mux_items
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'mux',
ADD COLUMN IF NOT EXISTS youtube_playlist_id text,
ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE current_stream
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'mux',
ADD COLUMN IF NOT EXISTS youtube_playlist_id text,
ADD COLUMN IF NOT EXISTS source_url text;

UPDATE mux_items
SET source_type = COALESCE(source_type, 'mux')
WHERE source_type IS NULL;

UPDATE current_stream
SET source_type = COALESCE(source_type, 'mux')
WHERE source_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mux_items_source_type_check'
  ) THEN
    ALTER TABLE mux_items
    ADD CONSTRAINT mux_items_source_type_check
    CHECK (source_type IN ('mux', 'youtube_playlist'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'current_stream_source_type_check'
  ) THEN
    ALTER TABLE current_stream
    ADD CONSTRAINT current_stream_source_type_check
    CHECK (source_type IN ('mux', 'youtube_playlist'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mux_items_youtube_playlist_id
ON mux_items(youtube_playlist_id)
WHERE source_type = 'youtube_playlist' AND youtube_playlist_id IS NOT NULL;

COMMENT ON COLUMN mux_items.source_type IS
  'Media source type. mux rows use playback_id as a Mux playback ID; youtube_playlist rows use youtube:playlist:{id}.';

COMMENT ON COLUMN mux_items.youtube_playlist_id IS
  'YouTube playlist ID for youtube_playlist media sources.';

COMMENT ON COLUMN mux_items.source_url IS
  'Original source URL entered by the admin.';

COMMENT ON COLUMN current_stream.source_type IS
  'Active media source type. Schedule and queue playback remain mux-only.';

CREATE OR REPLACE FUNCTION enqueue_video(mux_item_id uuid, admin_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  mux_data record;
  queued record;
  next_position int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('video_queue_order'));

  SELECT id, playback_id, label, kind, duration_seconds, COALESCE(source_type, 'mux') AS source_type
  INTO mux_data
  FROM mux_items
  WHERE id = mux_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mux item not found';
  END IF;

  IF mux_data.source_type <> 'mux' THEN
    RAISE EXCEPTION 'Only Mux items can be queued';
  END IF;

  SELECT COALESCE(MAX(position), 0) + 1
  INTO next_position
  FROM video_queue;

  INSERT INTO video_queue (mux_item_id, position)
  VALUES (mux_item_id, next_position)
  RETURNING id, position, created_at, mux_item_id
  INTO queued;

  INSERT INTO admin_actions (action_type, admin_user, details)
  VALUES (
    'queue_add',
    admin_user_id,
    json_build_object('mux_item_id', mux_item_id, 'position', next_position)
  );

  RETURN json_build_object(
    'id', queued.id,
    'position', queued.position,
    'created_at', queued.created_at,
    'mux_item_id', queued.mux_item_id,
    'mux_items', json_build_object(
      'id', mux_data.id,
      'playback_id', mux_data.playback_id,
      'label', mux_data.label,
      'kind', mux_data.kind,
      'duration_seconds', mux_data.duration_seconds,
      'source_type', mux_data.source_type
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION advance_queue_next(admin_user_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  next_item record;
  mux_data record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('video_queue_order'));

  PERFORM 1
  FROM current_stream
  WHERE id = 1
  FOR UPDATE;

  SELECT id, position, mux_item_id
  INTO next_item
  FROM video_queue
  ORDER BY position ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No videos in queue';
  END IF;

  SELECT playback_id, label, kind, COALESCE(source_type, 'mux') AS source_type
  INTO mux_data
  FROM mux_items
  WHERE id = next_item.mux_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid queue item data';
  END IF;

  IF mux_data.source_type <> 'mux' THEN
    RAISE EXCEPTION 'Only Mux items can be queued';
  END IF;

  UPDATE current_stream
  SET playback_id = mux_data.playback_id,
      title = mux_data.label,
      kind = COALESCE(mux_data.kind, 'vod'),
      source_type = 'mux',
      youtube_playlist_id = NULL,
      source_url = NULL,
      updated_at = NOW(),
      updated_by = admin_user_id,
      playback_state = 'playing',
      playback_position = 0,
      playout_mode = 'manual',
      schedule_early_ended_slot = NULL,
      schedule_early_ended_at = NULL,
      auto_advance_in_progress = false,
      auto_advance_lock_at = NULL,
      hold_screen_enabled = false,
      hold_screen_resume_playback_id = NULL,
      hold_screen_resume_position = NULL,
      hold_screen_resume_state = NULL,
      last_playback_command = 'queue_advance',
      last_command_id = 'advance-' || extract(epoch from NOW())::text
  WHERE id = 1;

  DELETE FROM video_queue WHERE id = next_item.id;

  CREATE TEMP TABLE IF NOT EXISTS temp_queue_repack (
    id uuid PRIMARY KEY,
    new_position int NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE temp_queue_repack;

  INSERT INTO temp_queue_repack (id, new_position)
  SELECT id, (row_number() OVER (ORDER BY position))::int
  FROM video_queue;

  UPDATE video_queue q
  SET position = -1000000 - t.new_position
  FROM temp_queue_repack t
  WHERE q.id = t.id;

  UPDATE video_queue q
  SET position = t.new_position
  FROM temp_queue_repack t
  WHERE q.id = t.id;

  INSERT INTO admin_actions (action_type, admin_user, details)
  VALUES (
    'queue_advance',
    admin_user_id,
    json_build_object(
      'to_playback_id', mux_data.playback_id,
      'to_title', mux_data.label
    )
  );

  RETURN json_build_object(
    'success', true,
    'playback_id', mux_data.playback_id,
    'title', mux_data.label,
    'kind', mux_data.kind,
    'source_type', mux_data.source_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_video(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION advance_queue_next(text) TO authenticated, anon;
