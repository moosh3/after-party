import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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

    // Update current stream
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .update({
        playback_id: playbackId,
        title: title,
        kind: kind,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
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

