-- Add event-level YouTube playlist shelf settings and cached video metadata.
-- Viewer traffic reads cached rows; only admin saves refresh from YouTube.

CREATE TABLE IF NOT EXISTS video_playlist_settings (
  id int PRIMARY KEY DEFAULT 1,
  source_url text,
  youtube_playlist_id text,
  title text NOT NULL DEFAULT 'Clip show',
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT single_video_playlist_settings_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS video_playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_playlist_id text NOT NULL,
  video_id text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,
  position int NOT NULL,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (youtube_playlist_id, video_id),
  UNIQUE (youtube_playlist_id, position)
);

CREATE INDEX IF NOT EXISTS idx_video_playlist_items_playlist_position
ON video_playlist_items(youtube_playlist_id, position);

ALTER TABLE video_playlist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_playlist_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'video_playlist_settings'
      AND policyname = 'Allow read access to video playlist settings'
  ) THEN
    CREATE POLICY "Allow read access to video playlist settings"
    ON video_playlist_settings
    FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'video_playlist_items'
      AND policyname = 'Allow read access to video playlist items'
  ) THEN
    CREATE POLICY "Allow read access to video playlist items"
    ON video_playlist_items
    FOR SELECT USING (true);
  END IF;
END;
$$;

COMMENT ON TABLE video_playlist_settings IS
  'Singleton event-level YouTube playlist shelf configuration.';

COMMENT ON TABLE video_playlist_items IS
  'Cached YouTube playlist item metadata used by the public event shelf.';

COMMENT ON COLUMN video_playlist_settings.source_url IS
  'Original YouTube playlist URL entered by an admin.';

COMMENT ON COLUMN video_playlist_settings.youtube_playlist_id IS
  'Normalized YouTube playlist ID for the active shelf.';
