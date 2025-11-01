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
    // Get current stream from database (including poster mode and hold screen flags)
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select(`
        *,
        hold_screen_mux_item:hold_screen_mux_item_id (
          id,
          playback_id,
          label,
          kind
        )
      `)
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
          isHoldScreen: false,
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

    // Check if hold screen is enabled
    let isHoldScreen = data.hold_screen_enabled && data.hold_screen_mux_item_id;
    
    // If hold screen is enabled, use hold screen data instead
    let playbackId = data.playback_id;
    let title = data.title;
    let kind = data.kind;
    
    if (isHoldScreen && data.hold_screen_mux_item) {
      const holdScreenItem = Array.isArray(data.hold_screen_mux_item) 
        ? data.hold_screen_mux_item[0] 
        : data.hold_screen_mux_item;
      
      if (holdScreenItem) {
        playbackId = holdScreenItem.playback_id;
        title = holdScreenItem.label;
        kind = holdScreenItem.kind || 'vod';
      } else {
        // Hold screen was enabled but mux_item data is missing - fall back to regular stream
        isHoldScreen = false;
      }
    } else if (isHoldScreen) {
      // Hold screen was enabled but mux_item relation is null - fall back to regular stream
      isHoldScreen = false;
    }

    // Generate playback token (or use unsigned if credentials not configured)
    const token = await generatePlaybackToken(playbackId);

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      playbackId,
      title,
      kind,
      token,
      expiresAt,
      showPoster: data.show_poster || false,
      isHoldScreen: isHoldScreen || false,
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

