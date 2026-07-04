export const YOUTUBE_PLAYLIST_SOURCE_TYPE = 'youtube_playlist' as const;
export const MUX_SOURCE_TYPE = 'mux' as const;

export type MediaSourceType =
  | typeof MUX_SOURCE_TYPE
  | typeof YOUTUBE_PLAYLIST_SOURCE_TYPE;

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const YOUTUBE_PLAYLIST_PREFIX = 'youtube:playlist:';

function isYouTubeHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'youtu.be' ||
    normalized === 'youtube.com' ||
    normalized.endsWith('.youtube.com') ||
    normalized === 'youtube-nocookie.com' ||
    normalized.endsWith('.youtube-nocookie.com')
  );
}

export function makeYouTubePlaylistPlaybackId(playlistId: string) {
  return `${YOUTUBE_PLAYLIST_PREFIX}${playlistId}`;
}

export function parseYouTubePlaylistPlaybackId(playbackId?: string | null) {
  if (!playbackId?.startsWith(YOUTUBE_PLAYLIST_PREFIX)) return null;
  const playlistId = playbackId.slice(YOUTUBE_PLAYLIST_PREFIX.length);
  return PLAYLIST_ID_PATTERN.test(playlistId) ? playlistId : null;
}

export function normalizeYouTubePlaylistId(value: string) {
  const playlistId = value.trim();

  if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
    throw new Error('Invalid YouTube playlist ID');
  }

  return playlistId;
}

export function extractYouTubePlaylistId(input: string) {
  const value = input.trim();

  if (!value) {
    throw new Error('YouTube playlist URL is required');
  }

  try {
    const url = new URL(value);

    if (!isYouTubeHost(url.hostname)) {
      throw new Error('URL must be a YouTube playlist link');
    }

    const playlistId = url.searchParams.get('list');
    if (!playlistId) {
      throw new Error('YouTube playlist URL must include a list parameter');
    }

    return normalizeYouTubePlaylistId(playlistId);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('YouTube')) {
      throw error;
    }

    if (PLAYLIST_ID_PATTERN.test(value)) {
      return value;
    }

    throw new Error('Invalid YouTube playlist URL');
  }
}
