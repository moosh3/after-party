import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

// GET - Fetch entire queue with video details
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('video_queue')
      .select(`
        id,
        position,
        created_at,
        mux_item_id,
        mux_items (
          id,
          playback_id,
          label,
          kind,
          duration_seconds
        )
      `)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching queue:', error);
      return NextResponse.json(
        { error: 'Failed to fetch queue' },
        { status: 500 }
      );
    }

    return NextResponse.json({ queue: data || [] });
  } catch (error) {
    console.error('Error fetching queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add video to queue
export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { muxItemId } = await request.json();

    if (!muxItemId) {
      return NextResponse.json(
        { error: 'muxItemId is required' },
        { status: 400 }
      );
    }

    // Verify mux item exists
    const { data: muxItem, error: muxError } = await supabaseAdmin
      .from('mux_items')
      .select('id')
      .eq('id', muxItemId)
      .single();

    if (muxError || !muxItem) {
      return NextResponse.json(
        { error: 'Mux item not found' },
        { status: 404 }
      );
    }

    // Get next position (max position + 1)
    const { data: maxPos } = await supabaseAdmin
      .from('video_queue')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPos?.position || 0) + 1;

    // Add to queue
    const { data, error } = await supabaseAdmin
      .from('video_queue')
      .insert({
        mux_item_id: muxItemId,
        position: nextPosition,
      })
      .select(`
        id,
        position,
        created_at,
        mux_item_id,
        mux_items (
          id,
          playback_id,
          label,
          kind,
          duration_seconds
        )
      `)
      .single();

    if (error) {
      console.error('Error adding to queue:', error);
      return NextResponse.json(
        { error: 'Failed to add to queue' },
        { status: 500 }
      );
    }

    // Log admin action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'queue_add',
      admin_user: session.userId,
      details: {
        mux_item_id: muxItemId,
        position: nextPosition,
      },
    });

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (error) {
    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Reorder queue items
// ISSUE #3: Now uses atomic database function for transaction safety
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { items } = await request.json();

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items array is required' },
        { status: 400 }
      );
    }

    // Validate that each item has id and position
    for (const item of items) {
      if (!item.id || typeof item.position !== 'number') {
        return NextResponse.json(
          { error: 'Each item must have id and position' },
          { status: 400 }
        );
      }
    }

    // ISSUE #3: Use atomic database function for transaction safety
    const { error } = await supabaseAdmin.rpc('reorder_queue', {
      items: JSON.stringify(items),
      admin_user_id: session.userId,
    });

    if (error) {
      console.error('Error reordering queue:', error);
      return NextResponse.json(
        { error: 'Failed to reorder queue' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

