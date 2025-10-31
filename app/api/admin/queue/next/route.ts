import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

// POST - Advance to next video in queue
export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the first item in the queue (position 1)
    const { data: nextItem, error: fetchError } = await supabaseAdmin
      .from('video_queue')
      .select(`
        id,
        position,
        mux_item_id,
        mux_items (
          id,
          playback_id,
          label,
          kind
        )
      `)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !nextItem) {
      return NextResponse.json(
        { error: 'No videos in queue', empty: true },
        { status: 404 }
      );
    }

    // Extract mux_items data (handle the array/object format)
    const muxItem = Array.isArray(nextItem.mux_items) 
      ? nextItem.mux_items[0] 
      : nextItem.mux_items;

    if (!muxItem) {
      return NextResponse.json(
        { error: 'Invalid queue item data' },
        { status: 500 }
      );
    }

    // Set this video as current stream
    const { data: updatedStream, error: updateError } = await supabaseAdmin
      .from('current_stream')
      .update({
        playback_id: muxItem.playback_id,
        title: muxItem.label,
        kind: muxItem.kind || 'vod',
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
        // Reset playback state when changing videos
        playback_state: 'paused',
        playback_position: 0,
        playback_updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating current stream:', updateError);
      return NextResponse.json(
        { error: 'Failed to update current stream' },
        { status: 500 }
      );
    }

    // Remove the video from queue
    const { error: deleteError } = await supabaseAdmin
      .from('video_queue')
      .delete()
      .eq('id', nextItem.id);

    if (deleteError) {
      console.error('Error removing item from queue:', deleteError);
      // Don't fail the request, just log it
    }

    // Reorder remaining items (shift all positions down by 1)
    const { data: remainingItems, error: remainingError } = await supabaseAdmin
      .from('video_queue')
      .select('id, position')
      .order('position', { ascending: true });

    if (!remainingError && remainingItems && remainingItems.length > 0) {
      const updates = remainingItems.map((item, index) =>
        supabaseAdmin
          .from('video_queue')
          .update({ position: index + 1 })
          .eq('id', item.id)
      );

      await Promise.all(updates);
    }

    // Log admin action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'queue_advance',
      admin_user: session.userId,
      details: {
        from_playback_id: updatedStream.playback_id,
        to_playback_id: muxItem.playback_id,
        to_title: muxItem.label,
      },
    });

    return NextResponse.json({
      success: true,
      stream: updatedStream,
      advanced_to: {
        playback_id: muxItem.playback_id,
        title: muxItem.label,
        kind: muxItem.kind,
      },
    });
  } catch (error) {
    console.error('Error advancing to next video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

