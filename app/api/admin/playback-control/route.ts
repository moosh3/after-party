import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, position } = await request.json();

    if (!action || !['play', 'pause', 'seek'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be play, pause, or seek' },
        { status: 400 }
      );
    }

    if (action === 'seek' && (position === undefined || position < 0)) {
      return NextResponse.json(
        { error: 'Position is required for seek action and must be >= 0' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      playback_updated_at: new Date().toISOString(),
    };

    if (action === 'play') {
      updateData.playback_state = 'playing';
    } else if (action === 'pause') {
      updateData.playback_state = 'paused';
    } else if (action === 'seek') {
      updateData.playback_position = position;
      // When seeking, keep current play/pause state
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
      playbackState: data.playback_state,
      playbackPosition: data.playback_position,
      message: `Playback ${action} command sent to all viewers`
    });
  } catch (error) {
    console.error('Error controlling playback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve current playback state
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('playback_state, playback_position, playback_updated_at')
      .eq('id', 1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch playback state' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching playback state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

