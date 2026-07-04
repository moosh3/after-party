import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';
import { moderateRateLimit } from '@/lib/rate-limit-enhanced';
import { resolveShowtimePlayout, type PlayoutMode } from '@/lib/showtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  return moderateRateLimit()(request, async (req: NextRequest) => {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  try {
    const { action, position, commandId } = await request.json();

    if (!action || !['play', 'pause', 'seek', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be play, pause, seek, or restart' },
        { status: 400 }
      );
    }

    if (action === 'seek' && (position === undefined || position < 0)) {
      return NextResponse.json(
        { error: 'Position is required for seek action and must be >= 0' },
        { status: 400 }
      );
    }
    
    // SYNC FIX: Generate command ID if not provided for deduplication
    const finalCommandId = commandId || `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get current stream state to preserve position if not provided
    const { data: currentData } = await supabaseAdmin
      .from('current_stream')
      .select(`
        *,
        mux_items:playback_id (
          duration_seconds
        )
      `)
      .eq('id', 1)
      .single();

    if ((currentData?.playout_mode || 'schedule') === 'schedule') {
      return NextResponse.json(
        {
          error: 'Schedule mode is active. Switch to manual mode before sending playback commands.',
        },
        { status: 409 }
      );
    }

    // ISSUE #8: Validate seek position against video duration
    if (action === 'seek' && position !== undefined) {
      // Try to get duration from joined mux_items
      let duration: number | null = null;
      
      if (currentData?.mux_items) {
        const muxData = Array.isArray(currentData.mux_items) 
          ? currentData.mux_items[0] 
          : currentData.mux_items;
        duration = muxData?.duration_seconds;
      }
      
      // If we don't have duration from the join, try a direct query
      if (!duration && currentData?.playback_id) {
        const { data: muxItem } = await supabaseAdmin
          .from('mux_items')
          .select('duration_seconds')
          .eq('playback_id', currentData.playback_id)
          .single();
        
        duration = muxItem?.duration_seconds;
      }
      
      // Validate position against duration if we have it
      if (duration && position > duration) {
        return NextResponse.json(
          { error: `Position ${position}s exceeds video duration ${duration}s` },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      // Don't manually set playback_updated_at - let the trigger handle it
      last_playback_command: action,
      last_command_id: finalCommandId,
    };

    if (action === 'play') {
      updateData.playback_state = 'playing';
      // Update position if provided, otherwise keep current position
      if (position !== undefined) {
        updateData.playback_position = position;
      } else if (currentData?.playback_position !== undefined) {
        updateData.playback_position = currentData.playback_position;
      }
    } else if (action === 'pause') {
      updateData.playback_state = 'paused';
      // Update position if provided, otherwise keep current position
      if (position !== undefined) {
        updateData.playback_position = position;
      } else if (currentData?.playback_position !== undefined) {
        updateData.playback_position = currentData.playback_position;
      }
    } else if (action === 'seek') {
      updateData.playback_position = position;
      // When seeking, keep current play/pause state
    } else if (action === 'restart') {
      // ISSUE #10: Atomic restart operation - seek to 0 and start playing
      updateData.playback_state = 'playing';
      updateData.playback_position = 0;
    }

    // Update current_stream with new playback state
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .update(updateData)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('Failed to update playback state:', error);
      return NextResponse.json(
        { error: 'Failed to update playback state' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      playback_state: data.playback_state,
      playback_position: data.playback_position,
      playback_elapsed_ms: data.playback_elapsed_ms || 0,
      playback_updated_at: data.playback_updated_at,
      command_id: finalCommandId,
      message: `Playback ${action} command sent to all viewers`
    });
  } catch (error) {
    console.error('Error controlling playback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  });
}

// GET endpoint to retrieve current playback state
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch playback state' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const playoutMode: PlayoutMode = data.playout_mode || 'schedule';

    if (playoutMode === 'schedule') {
      const resolved = resolveShowtimePlayout(
        new Date(),
        data.schedule_early_ended_slot,
        data.schedule_early_ended_at
      );

      return NextResponse.json(
        {
          playout_mode: playoutMode,
          playback_state: resolved.playbackState,
          playback_position: resolved.playbackPosition,
          playback_updated_at: resolved.playbackUpdatedAt,
          playback_elapsed_ms: resolved.playbackElapsedMs,
          last_playback_command: data.last_playback_command,
          last_command_id: data.last_command_id,
          schedule_status: resolved.status,
          active_slot_id: resolved.activeSlotId,
          active_asset_key: resolved.activeAssetKey,
          next_transition_at: resolved.nextTransitionAt,
          title: resolved.title,
          is_hold_screen: resolved.isHoldScreen,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ...data,
        playout_mode: playoutMode,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error('Error fetching playback state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
