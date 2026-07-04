export const YOUTUBE_PLAYLIST_SOURCE_TYPE = 'youtube_playlist' as const;
export const YOUTUBE_VIDEO_SOURCE_TYPE = 'youtube_video' as const;
export const MUX_SOURCE_TYPE = 'mux' as const;

export type MediaSourceType =
  | typeof MUX_SOURCE_TYPE
  | typeof YOUTUBE_PLAYLIST_SOURCE_TYPE
  | typeof YOUTUBE_VIDEO_SOURCE_TYPE;

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLAYLIST_PREFIX = 'youtube:playlist:';
const YOUTUBE_VIDEO_PREFIX = 'youtube:video:';

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

export function makeYouTubeVideoPlaybackId(videoId: string) {
  return `${YOUTUBE_VIDEO_PREFIX}${videoId}`;
}

export function parseYouTubeVideoPlaybackId(playbackId?: string | null) {
  if (!playbackId?.startsWith(YOUTUBE_VIDEO_PREFIX)) return null;
  const videoId = playbackId.slice(YOUTUBE_VIDEO_PREFIX.length);
  return VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
}

export function normalizeYouTubePlaylistId(value: string) {
  const playlistId = value.trim();

  if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
    throw new Error('Invalid YouTube playlist ID');
  }

  return playlistId;
}

export function normalizeYouTubeVideoId(value: string) {
  const videoId = value.trim();

  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw new Error('Invalid YouTube video ID');
  }

  return videoId;
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

export function extractYouTubeVideoId(input: string) {
  const value = input.trim();

  if (!value) {
    throw new Error('YouTube video URL is required');
  }

  try {
    const url = new URL(value);

    if (!isYouTubeHost(url.hostname)) {
      throw new Error('YouTube video URL must be a YouTube link');
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const videoId =
      url.searchParams.get('v') ||
      (url.hostname.toLowerCase() === 'youtu.be' ? pathParts[0] : null) ||
      (['embed', 'shorts', 'live', 'v'].includes(pathParts[0]) ? pathParts[1] : null);

    if (!videoId) {
      throw new Error('YouTube video URL must include a video ID');
    }

    return normalizeYouTubeVideoId(videoId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('YouTube video') || error.message.startsWith('Invalid YouTube video'))
    ) {
      throw error;
    }

    if (VIDEO_ID_PATTERN.test(value)) {
      return value;
    }

    throw new Error('Invalid YouTube video URL or ID');
  }
}

export interface YouTubePlaylistVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  position: number;
  publishedAt: string | null;
}

type YouTubeThumbnail = {
  url?: string;
};

export type YouTubePlaylistApiItem = {
  snippet?: {
    title?: string;
    position?: number;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
      standard?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    };
    resourceId?: {
      videoId?: string;
    };
    publishedAt?: string;
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
};

export function mapYouTubePlaylistApiItem(
  item: YouTubePlaylistApiItem,
  fallbackPosition: number
): YouTubePlaylistVideo | null {
  const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
  const title = item.snippet?.title?.trim();

  if (!videoId || !title || title === 'Deleted video' || title === 'Private video') {
    return null;
  }

  const thumbnails = item.snippet?.thumbnails;
  const thumbnailUrl =
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    null;

  return {
    videoId,
    title,
    thumbnailUrl,
    position: item.snippet?.position ?? fallbackPosition,
    publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null,
  };
}
