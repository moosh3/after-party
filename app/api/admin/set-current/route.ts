import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { playbackId, title, kind = 'vod' } = await request.json();

    if (!playbackId || !title) {
      return NextResponse.json(
        { error: 'playbackId and title are required' },
        { status: 400 }
      );
    }

    // ISSUE #4: Update current stream and reset playback state
    // SYNC FIX: Let the trigger handle playback_updated_at and playback_elapsed_ms
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .update({
        playback_id: playbackId,
        title: title,
        kind: kind,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
        // Reset playback state when changing videos manually
        playback_state: 'playing',
        playback_position: 0,
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
        playback_id: playbackId,
        title: title,
        kind: kind,
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

