import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

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
    const { playbackId, label, kind = 'vod', durationSeconds } = await request.json();

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
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'This playback ID already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to add Mux item' },
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

