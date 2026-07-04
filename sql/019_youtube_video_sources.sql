-- Allow single YouTube videos in the media library.
-- Video rows use source_type = 'youtube_video' and playback_id = youtube:video:{id}.

ALTER TABLE mux_items
DROP CONSTRAINT IF EXISTS mux_items_source_type_check;

ALTER TABLE mux_items
ADD CONSTRAINT mux_items_source_type_check
CHECK (source_type IN ('mux', 'youtube_playlist', 'youtube_video'));

ALTER TABLE current_stream
DROP CONSTRAINT IF EXISTS current_stream_source_type_check;

ALTER TABLE current_stream
ADD CONSTRAINT current_stream_source_type_check
CHECK (source_type IN ('mux', 'youtube_playlist', 'youtube_video'));

COMMENT ON COLUMN mux_items.source_type IS
  'Media source type. mux rows use Mux playback IDs; youtube_playlist rows use youtube:playlist:{id}; youtube_video rows use youtube:video:{id}.';

COMMENT ON COLUMN current_stream.source_type IS
  'Active media source type. Schedule and queue playback remain mux-only.';
