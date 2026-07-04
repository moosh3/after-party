import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';
import {
  MUX_SOURCE_TYPE,
  YOUTUBE_PLAYLIST_SOURCE_TYPE,
  YOUTUBE_VIDEO_SOURCE_TYPE,
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  makeYouTubePlaylistPlaybackId,
  makeYouTubeVideoPlaybackId,
  parseYouTubePlaylistPlaybackId,
  parseYouTubeVideoPlaybackId,
  type MediaSourceType,
} from '@/lib/youtube';

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      playbackId,
      title,
      kind = 'vod',
      sourceType: rawSourceType,
      source_type: rawSourceTypeSnake,
      youtubePlaylistId,
      youtube_playlist_id: youtubePlaylistIdSnake,
      youtubeVideoId,
      youtube_video_id: youtubeVideoIdSnake,
      sourceUrl,
      source_url: sourceUrlSnake,
    } = await request.json();
    const sourceType: MediaSourceType =
      rawSourceType || rawSourceTypeSnake || MUX_SOURCE_TYPE;
    let nextPlaybackId = playbackId;
    let nextKind = kind;
    let nextSourceType: MediaSourceType = MUX_SOURCE_TYPE;
    let nextYoutubePlaylistId: string | null = null;
    let nextYoutubeVideoId: string | null = null;
    let nextSourceUrl: string | null = null;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    if (sourceType === YOUTUBE_PLAYLIST_SOURCE_TYPE) {
      const playbackPlaylistId = parseYouTubePlaylistPlaybackId(playbackId);
      const playlistInput =
        youtubePlaylistId || youtubePlaylistIdSnake || playbackPlaylistId || sourceUrl || sourceUrlSnake || playbackId;

      try {
        nextYoutubePlaylistId = extractYouTubePlaylistId(playlistInput || '');
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid YouTube playlist URL' },
          { status: 400 }
        );
      }

      nextPlaybackId = makeYouTubePlaylistPlaybackId(nextYoutubePlaylistId);
      nextKind = 'vod';
      nextSourceType = YOUTUBE_PLAYLIST_SOURCE_TYPE;
      nextSourceUrl =
        sourceUrl || sourceUrlSnake || `https://www.youtube.com/playlist?list=${nextYoutubePlaylistId}`;
    } else if (sourceType === YOUTUBE_VIDEO_SOURCE_TYPE) {
      const playbackVideoId = parseYouTubeVideoPlaybackId(playbackId);
      const videoInput =
        youtubeVideoId || youtubeVideoIdSnake || playbackVideoId || sourceUrl || sourceUrlSnake || playbackId;

      try {
        nextYoutubeVideoId = extractYouTubeVideoId(videoInput || '');
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid YouTube video URL' },
          { status: 400 }
        );
      }

      nextPlaybackId = makeYouTubeVideoPlaybackId(nextYoutubeVideoId);
      nextKind = 'vod';
      nextSourceType = YOUTUBE_VIDEO_SOURCE_TYPE;
      nextSourceUrl =
        sourceUrl || sourceUrlSnake || `https://www.youtube.com/watch?v=${nextYoutubeVideoId}`;
    } else if (sourceType === MUX_SOURCE_TYPE) {
      if (!playbackId) {
        return NextResponse.json(
          { error: 'playbackId is required' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid sourceType' },
        { status: 400 }
      );
    }

    // ISSUE #4: Update current stream and reset playback state
    // SYNC FIX: Let the trigger handle playback_updated_at and playback_elapsed_ms
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .update({
        playback_id: nextPlaybackId,
        title: title,
        kind: nextKind,
        source_type: nextSourceType,
        youtube_playlist_id: nextYoutubePlaylistId,
        source_url: nextSourceUrl,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
        // Reset playback state when changing videos manually
        playback_state: 'playing',
        playback_position: 0,
        playout_mode: 'manual',
        schedule_early_ended_slot: null,
        schedule_early_ended_at: null,
        // Removed: playback_updated_at - let trigger handle it
        // Removed: playback_elapsed_ms - let trigger handle it
        // Disable hold screen when manually setting a new video
        hold_screen_enabled: false,
        hold_screen_resume_playback_id: null,
        hold_screen_resume_position: null,
        hold_screen_resume_state: null,
        // Add command tracking
        last_playback_command: 'set_video',
        last_command_id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update stream' },
        { status: 500 }
      );
    }

    // Log admin action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'stream_change',
      admin_user: session.userId,
      details: {
        playback_id: nextPlaybackId,
        title: title,
        kind: nextKind,
        source_type: nextSourceType,
        youtube_playlist_id: nextYoutubePlaylistId,
        youtube_video_id: nextYoutubeVideoId,
        source_url: nextSourceUrl,
      },
    });

    return NextResponse.json({
      success: true,
      updatedAt: data.updated_at,
      stream: data,
    });
  } catch (error) {
    console.error('Error updating stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch current stream' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
