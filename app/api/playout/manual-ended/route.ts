import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { MUX_SOURCE_TYPE } from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { playbackId } = await request.json();

    if (!playbackId) {
      return NextResponse.json({ error: 'playbackId is required' }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from('current_stream')
      .select('playout_mode, playback_id, source_type, playback_state, playback_position, playback_updated_at, auto_advance_enabled, hold_screen_enabled')
      .eq('id', 1)
      .single();

    if (currentError) {
      return NextResponse.json({ error: 'Failed to read playout state' }, { status: 500 });
    }

    if ((current.playout_mode || 'schedule') !== 'manual') {
      return NextResponse.json({ success: true, ignored: true, reason: 'schedule-mode' });
    }

    if ((current.source_type || MUX_SOURCE_TYPE) !== MUX_SOURCE_TYPE) {
      return NextResponse.json({ success: true, ignored: true, reason: 'non-mux-source' });
    }

    if (!current.auto_advance_enabled) {
      return NextResponse.json({ success: true, ignored: true, reason: 'auto-advance-disabled' });
    }

    if (current.hold_screen_enabled) {
      return NextResponse.json({ success: true, ignored: true, reason: 'hold-screen' });
    }

    if (current.playback_id !== playbackId) {
      return NextResponse.json({ success: true, ignored: true, reason: 'not-current-video' });
    }

    const { data: muxItem } = await supabaseAdmin
      .from('mux_items')
      .select('duration_seconds')
      .eq('playback_id', playbackId)
      .single();

    const duration = muxItem?.duration_seconds ? Number(muxItem.duration_seconds) : null;
    if (duration && duration > 90) {
      const updatedAt = new Date(current.playback_updated_at).getTime();
      const basePosition = Number(current.playback_position || 0);
      const estimatedPosition =
        current.playback_state === 'playing' && !Number.isNaN(updatedAt)
          ? basePosition + (Date.now() - updatedAt) / 1000
          : basePosition;

      if (estimatedPosition < duration - 60) {
        return NextResponse.json(
          { success: true, ignored: true, reason: 'too-early' },
          { status: 202 }
        );
      }
    }

    const { data, error } = await supabaseAdmin.rpc('advance_queue_next', {
      admin_user_id: 'system:auto-advance',
    });

    if (error) {
      if (error.message.includes('No videos in queue')) {
        return NextResponse.json({ success: true, empty: true });
      }

      console.error('Failed to advance manual queue:', error);
      return NextResponse.json({ error: 'Failed to advance manual queue' }, { status: 500 });
    }

    return NextResponse.json({ success: true, advancedTo: data });
  } catch (error) {
    console.error('Error handling manual ended notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
