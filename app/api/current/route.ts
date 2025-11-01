import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generatePlaybackToken } from '@/lib/mux';
import { getViewerData } from '@/lib/viewer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Verify viewer authentication (client-side localStorage-based)
  // In a production system, you might want to verify viewer data server-side
  // For now, we'll allow access if the request comes from a browser context
  
  try {
    // Get current stream from database (including poster mode flag)
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      // DEVELOPMENT MODE: Return mock data if database is not configured
      // This allows the UI to be tested without full Supabase setup
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const isDevelopment = supabaseUrl.includes('placeholder') || supabaseUrl === '';
      
      if (isDevelopment || error?.message?.includes('connect')) {
        console.log('⚠️  Development mode: Returning mock stream data');
        const mockToken = 'mock-token-for-development';
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        
        return NextResponse.json({
          playbackId: 'demo-playback-id',
          title: 'Demo Stream - Configure Supabase & Mux for real video',
          kind: 'vod',
          token: mockToken,
          expiresAt,
          showPoster: false,
        }, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }
      
      return NextResponse.json(
        { error: 'No active stream configured' },
        { status: 404 }
      );
    }

    // Generate signed playback token
    let token: string;
    try {
      token = generatePlaybackToken(data.playback_id);
    } catch (tokenError) {
      console.error('Failed to generate Mux playback token:', tokenError);
      // In production, if Mux is not configured, we can't serve video
      // Return error with helpful message
      return NextResponse.json(
        { 
          error: 'Video service not configured',
          details: 'Mux credentials are not properly configured. Please contact the administrator.'
        },
        { status: 503 } // Service Unavailable
      );
    }

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      playbackId: data.playback_id,
      title: data.title,
      kind: data.kind,
      token,
      expiresAt,
      showPoster: data.show_poster || false,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching current stream:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

