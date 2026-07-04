import {
  mapYouTubePlaylistApiItem,
  type YouTubePlaylistApiItem,
  type YouTubePlaylistVideo,
} from '@/lib/youtube';

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string;
  items?: YouTubePlaylistApiItem[];
  error?: {
    message?: string;
  };
};

export async function fetchYouTubePlaylistItems(playlistId: string): Promise<YouTubePlaylistVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured');
  }

  const videos: YouTubePlaylistVideo[] = [];
  let pageToken: string | undefined;
  let fallbackPosition = 0;

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      maxResults: '50',
      playlistId,
      key: apiKey,
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`);
    const data = (await response.json()) as YouTubePlaylistItemsResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch YouTube playlist');
    }

    for (const item of data.items || []) {
      const video = mapYouTubePlaylistApiItem(item, fallbackPosition);
      fallbackPosition += 1;

      if (video) {
        videos.push(video);
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return videos.sort((a, b) => a.position - b.position);
}
