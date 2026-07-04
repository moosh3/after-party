import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function disabledResponse() {
  return NextResponse.json(
    {
      enabled: false,
      title: 'Clip show',
      sourceUrl: null,
      playlistId: null,
      items: [],
    },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}

export async function GET() {
  try {
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('video_playlist_settings')
      .select('source_url, youtube_playlist_id, title, is_enabled')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to load video playlist settings:', settingsError);
      return disabledResponse();
    }

    if (!settings?.is_enabled || !settings.youtube_playlist_id) {
      return disabledResponse();
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('video_playlist_items')
      .select('video_id, title, thumbnail_url, position, published_at')
      .eq('youtube_playlist_id', settings.youtube_playlist_id)
      .order('position', { ascending: true });

    if (itemsError) {
      console.error('Failed to load video playlist items:', itemsError);
      return disabledResponse();
    }

    return NextResponse.json(
      {
        enabled: true,
        title: settings.title || 'Clip show',
        sourceUrl: settings.source_url,
        playlistId: settings.youtube_playlist_id,
        items: (items || []).map((item) => ({
          videoId: item.video_id,
          title: item.title,
          thumbnailUrl: item.thumbnail_url,
          position: item.position,
          publishedAt: item.published_at,
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching video playlist:', error);
    return disabledResponse();
  }
}
