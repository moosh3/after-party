import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';
import { extractYouTubePlaylistId } from '@/lib/youtube';
import { fetchYouTubePlaylistItems } from '@/lib/youtube-playlist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function requireAdmin() {
  const session = await getSession();
  return session?.role === 'admin' ? session : null;
}

async function loadCachedPlaylist() {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('video_playlist_settings')
    .select('source_url, youtube_playlist_id, title, is_enabled, updated_at, updated_by')
    .eq('id', 1)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  if (!settings?.youtube_playlist_id) {
    return {
      settings: {
        sourceUrl: null,
        playlistId: null,
        title: 'Clip show',
        isEnabled: false,
        updatedAt: null,
        updatedBy: null,
      },
      items: [],
    };
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('video_playlist_items')
    .select('video_id, title, thumbnail_url, position, published_at, fetched_at')
    .eq('youtube_playlist_id', settings.youtube_playlist_id)
    .order('position', { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  return {
    settings: {
      sourceUrl: settings.source_url,
      playlistId: settings.youtube_playlist_id,
      title: settings.title || 'Clip show',
      isEnabled: Boolean(settings.is_enabled),
      updatedAt: settings.updated_at,
      updatedBy: settings.updated_by,
    },
    items: (items || []).map((item) => ({
      videoId: item.video_id,
      title: item.title,
      thumbnailUrl: item.thumbnail_url,
      position: item.position,
      publishedAt: item.published_at,
      fetchedAt: item.fetched_at,
    })),
  };
}

export async function GET() {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadCachedPlaylist());
  } catch (error) {
    console.error('Failed to load admin video playlist:', error);
    return NextResponse.json({ error: 'Failed to load video playlist' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sourceUrl = String(body.sourceUrl || body.source_url || '').trim();
    const title = String(body.title || 'Clip show').trim() || 'Clip show';
    const isEnabled = body.isEnabled ?? body.is_enabled ?? true;

    let playlistId: string;
    try {
      playlistId = extractYouTubePlaylistId(sourceUrl);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid YouTube playlist URL' },
        { status: 400 }
      );
    }

    let videos;
    try {
      videos = await fetchYouTubePlaylistItems(playlistId);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch YouTube playlist' },
        { status: 502 }
      );
    }

    if (videos.length === 0) {
      return NextResponse.json(
        { error: 'No public videos found in this playlist' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const rows = videos.map((video) => ({
      youtube_playlist_id: playlistId,
      video_id: video.videoId,
      title: video.title,
      thumbnail_url: video.thumbnailUrl,
      position: video.position,
      published_at: video.publishedAt,
      fetched_at: now,
    }));

    const { error: deleteError } = await supabaseAdmin
      .from('video_playlist_items')
      .delete()
      .eq('youtube_playlist_id', playlistId);

    if (deleteError) {
      console.error('Failed to clear previous playlist items:', deleteError);
      return NextResponse.json({ error: 'Failed to refresh cached playlist items' }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin
      .from('video_playlist_items')
      .insert(rows);

    if (insertError) {
      console.error('Failed to cache playlist items:', insertError);
      return NextResponse.json({ error: 'Failed to cache playlist items' }, { status: 500 });
    }

    const { error: settingsError } = await supabaseAdmin
      .from('video_playlist_settings')
      .upsert({
        id: 1,
        source_url: sourceUrl,
        youtube_playlist_id: playlistId,
        title,
        is_enabled: Boolean(isEnabled),
        updated_at: now,
        updated_by: session.userId,
      });

    if (settingsError) {
      console.error('Failed to save playlist settings:', settingsError);
      return NextResponse.json({ error: 'Failed to save playlist settings' }, { status: 500 });
    }

    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'video_playlist_update',
      admin_user: session.userId,
      details: {
        youtube_playlist_id: playlistId,
        source_url: sourceUrl,
        title,
        item_count: rows.length,
        is_enabled: Boolean(isEnabled),
      },
    });

    return NextResponse.json(await loadCachedPlaylist());
  } catch (error) {
    console.error('Error saving video playlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await requireAdmin();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('video_playlist_settings')
      .upsert({
        id: 1,
        source_url: null,
        youtube_playlist_id: null,
        title: 'Clip show',
        is_enabled: false,
        updated_at: now,
        updated_by: session.userId,
      });

    if (error) {
      console.error('Failed to disable video playlist:', error);
      return NextResponse.json({ error: 'Failed to disable video playlist' }, { status: 500 });
    }

    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'video_playlist_disable',
      admin_user: session.userId,
      details: { disabled_at: now },
    });

    return NextResponse.json(await loadCachedPlaylist());
  } catch (error) {
    console.error('Error disabling video playlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
