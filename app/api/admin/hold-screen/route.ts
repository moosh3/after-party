import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

// GET - Fetch current hold screen configuration
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select(`
        hold_screen_enabled,
        hold_screen_mux_item_id,
        mux_items:hold_screen_mux_item_id (
          id,
          playback_id,
          label,
          kind,
          duration_seconds
        )
      `)
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching hold screen config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch hold screen configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hold_screen_enabled: data.hold_screen_enabled || false,
      hold_screen_mux_item_id: data.hold_screen_mux_item_id || null,
      mux_item: data.mux_items || null,
    });
  } catch (error) {
    console.error('Error fetching hold screen config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Update hold screen configuration
export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, muxItemId } = await request.json();

    if (!action || !['enable', 'disable', 'set_item'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be enable, disable, or set_item' },
        { status: 400 }
      );
    }

    // If setting a new item, validate it exists
    if (action === 'set_item') {
      if (!muxItemId) {
        return NextResponse.json(
          { error: 'muxItemId is required for set_item action' },
          { status: 400 }
        );
      }

      const { data: muxItem, error: muxError } = await supabaseAdmin
        .from('mux_items')
        .select('id, playback_id, label')
        .eq('id', muxItemId)
        .single();

      if (muxError || !muxItem) {
        return NextResponse.json(
          { error: 'Mux item not found' },
          { status: 404 }
        );
      }

      // Set the hold screen item (but don't enable it yet)
      const { data, error } = await supabaseAdmin
        .from('current_stream')
        .update({
          hold_screen_mux_item_id: muxItemId,
        })
        .eq('id', 1)
        .select()
        .single();

      if (error) {
        console.error('Failed to set hold screen item:', error);
        return NextResponse.json(
          { error: 'Failed to set hold screen item' },
          { status: 500 }
        );
      }

      // Log admin action
      await supabaseAdmin.from('admin_actions').insert({
        action_type: 'hold_screen_set_item',
        admin_user: session.userId,
        details: {
          mux_item_id: muxItemId,
          label: muxItem.label,
          playback_id: muxItem.playback_id,
        },
      });

      return NextResponse.json({
        success: true,
        hold_screen_mux_item_id: data.hold_screen_mux_item_id,
        hold_screen_enabled: data.hold_screen_enabled,
        message: `Hold screen set to "${muxItem.label}"`,
      });
    }

    // Enable or disable hold screen
    if (action === 'enable' || action === 'disable') {
      const enabled = action === 'enable';

      const { data: currentData, error: currentError } = await supabaseAdmin
        .from('current_stream')
        .select('playback_id, playback_position, playback_state, hold_screen_mux_item_id, hold_screen_resume_playback_id, hold_screen_resume_position, hold_screen_resume_state')
        .eq('id', 1)
        .single();

      if (currentError) {
        console.error('Failed to load current stream for hold screen toggle:', currentError);
        return NextResponse.json(
          { error: 'Failed to toggle hold screen' },
          { status: 500 }
        );
      }

      // If enabling, make sure we have a hold screen item set
      if (enabled) {
        if (!currentData?.hold_screen_mux_item_id) {
          return NextResponse.json(
            { error: 'No hold screen item configured. Set one first.' },
            { status: 400 }
          );
        }
      }

      const updatePayload: any = {
        hold_screen_enabled: enabled,
      };

      if (enabled) {
        updatePayload.playback_state = 'paused';
        updatePayload.playback_position = 0;
        updatePayload.playback_updated_at = new Date().toISOString();
        updatePayload.playback_elapsed_ms = 0;
        updatePayload.hold_screen_resume_playback_id = currentData?.playback_id || null;
        updatePayload.hold_screen_resume_position = currentData?.playback_position ?? 0;
        updatePayload.hold_screen_resume_state = currentData?.playback_state || 'paused';
      } else {
        const resumePlaybackId = currentData?.hold_screen_resume_playback_id || currentData?.playback_id;
        const resumePosition = currentData?.hold_screen_resume_position ?? 0;
        const resumeState = currentData?.hold_screen_resume_state || 'playing';

        updatePayload.playback_id = resumePlaybackId;
        updatePayload.playback_position = resumePosition;
        updatePayload.playback_state = resumeState;
        updatePayload.playback_updated_at = new Date().toISOString();
        updatePayload.playback_elapsed_ms = 0;
        updatePayload.hold_screen_resume_playback_id = null;
        updatePayload.hold_screen_resume_position = null;
        updatePayload.hold_screen_resume_state = null;
      }

      const { data, error } = await supabaseAdmin
        .from('current_stream')
        .update(updatePayload)
        .eq('id', 1)
        .select()
        .single();

      if (error) {
        console.error('Failed to toggle hold screen:', error);
        return NextResponse.json(
          { error: 'Failed to toggle hold screen' },
          { status: 500 }
        );
      }

      // Log admin action
      await supabaseAdmin.from('admin_actions').insert({
        action_type: enabled ? 'hold_screen_enable' : 'hold_screen_disable',
        admin_user: session.userId,
        details: {
          hold_screen_enabled: enabled,
        },
      });

      return NextResponse.json({
        success: true,
        hold_screen_enabled: data.hold_screen_enabled,
        message: `Hold screen ${enabled ? 'enabled' : 'disabled'}`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating hold screen:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

