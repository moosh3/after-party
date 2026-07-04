import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';
import {
  MUX_SOURCE_TYPE,
  YOUTUBE_PLAYLIST_SOURCE_TYPE,
  extractYouTubePlaylistId,
  makeYouTubePlaylistPlaybackId,
  parseYouTubePlaylistPlaybackId,
  type MediaSourceType,
} from '@/lib/youtube';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('mux_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch Mux items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Error fetching Mux items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      playbackId,
      label,
      kind = 'vod',
      durationSeconds,
      sourceType: rawSourceType,
      source_type: rawSourceTypeSnake,
      sourceUrl,
      source_url: sourceUrlSnake,
      youtubePlaylistId,
      youtube_playlist_id: youtubePlaylistIdSnake,
    } = await request.json();
    const sourceType: MediaSourceType =
      rawSourceType || rawSourceTypeSnake || MUX_SOURCE_TYPE;

    if (sourceType === YOUTUBE_PLAYLIST_SOURCE_TYPE) {
      const playbackPlaylistId = parseYouTubePlaylistPlaybackId(playbackId);
      const playlistInput = sourceUrl || sourceUrlSnake || youtubePlaylistId || youtubePlaylistIdSnake || playbackPlaylistId;
      let playlistId: string;

      try {
        playlistId = extractYouTubePlaylistId(playlistInput || '');
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid YouTube playlist URL' },
          { status: 400 }
        );
      }

      const playlistPlaybackId = makeYouTubePlaylistPlaybackId(playlistId);
      const { data, error } = await supabaseAdmin
        .from('mux_items')
        .insert({
          playback_id: playlistPlaybackId,
          label: label || `YouTube Playlist ${playlistId}`,
          kind: 'vod',
          duration_seconds: null,
          source_type: YOUTUBE_PLAYLIST_SOURCE_TYPE,
          youtube_playlist_id: playlistId,
          source_url: sourceUrl || sourceUrlSnake || `https://www.youtube.com/playlist?list=${playlistId}`,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'This YouTube playlist already exists' },
            { status: 409 }
          );
        }

        console.error('Failed to add YouTube playlist:', error);
        return NextResponse.json(
          { error: 'Failed to add YouTube playlist' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, item: data }, { status: 201 });
    }

    if (sourceType !== MUX_SOURCE_TYPE) {
      return NextResponse.json(
        { error: 'Invalid sourceType' },
        { status: 400 }
      );
    }

    if (!playbackId) {
      return NextResponse.json(
        { error: 'playbackId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('mux_items')
      .insert({
        playback_id: playbackId,
        label: label || playbackId,
        kind: kind,
        duration_seconds: durationSeconds,
        source_type: MUX_SOURCE_TYPE,
        youtube_playlist_id: null,
        source_url: null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'This media item already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to add media item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (error) {
    console.error('Error adding Mux item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Check if this item is currently being used
    const { data: currentStream } = await supabaseAdmin
      .from('current_stream')
      .select('playback_id')
      .single();

    const { data: itemToDelete } = await supabaseAdmin
      .from('mux_items')
      .select('playback_id')
      .eq('id', id)
      .single();

    if (currentStream && itemToDelete && currentStream.playback_id === itemToDelete.playback_id) {
      return NextResponse.json(
        { error: 'Cannot delete the currently active stream. Please select a different stream first.' },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin
      .from('mux_items')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete Mux item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Mux item deleted successfully' });
  } catch (error) {
    console.error('Error deleting Mux item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
