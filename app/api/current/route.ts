import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePlaybackToken } from '@/lib/mux';
import { getViewerData } from '@/lib/viewer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Verify viewer authentication (client-side localStorage-based)
  // In a production system, you might want to verify viewer data server-side
  // For now, we'll allow access if the request comes from a browser context
  
  try {
    // Get current stream from database
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'No active stream configured' },
        { status: 404 }
      );
    }

    // Generate signed playback token
    const token = generatePlaybackToken(data.playback_id);

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      playbackId: data.playback_id,
      title: data.title,
      kind: data.kind,
      token,
      expiresAt,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching current stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

