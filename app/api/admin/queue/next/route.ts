import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

/**
 * Retry logic with exponential backoff for transient failures
 */
async function advanceQueueWithRetry(userId: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabaseAdmin.rpc('advance_queue_next', {
        admin_user_id: userId,
      });
      
      if (!error) {
        return { data, error: null };
      }
      
      // Don't retry known non-transient errors
      if (error.message.includes('No videos in queue')) {
        return { data: null, error };
      }
      if (error.message.includes('already in progress')) {
        return { data: null, error };
      }
      
      // If this is our last attempt, return the error
      if (attempt === maxAttempts) {
        return { data: null, error };
      }
      
      // Exponential backoff: 100ms, 200ms, 400ms
      const backoffMs = 100 * Math.pow(2, attempt - 1);
      console.log(`⚠️ Retry attempt ${attempt}/${maxAttempts} after ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      
      const backoffMs = 100 * Math.pow(2, attempt - 1);
      console.log(`⚠️ Retry attempt ${attempt}/${maxAttempts} after ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  return { data: null, error: new Error('Max retry attempts exceeded') };
}

// POST - Advance to next video in queue
// ISSUE #7: Now uses atomic database function for idempotency and transaction safety
export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use retry logic with exponential backoff
    const { data, error } = await advanceQueueWithRetry(session.userId);

    if (error) {
      // Check if it's a known error condition
      if (error.message.includes('No videos in queue')) {
        return NextResponse.json(
          { error: 'No videos in queue', empty: true },
          { status: 404 }
        );
      }
      
      if (error.message.includes('already in progress')) {
        return NextResponse.json(
          { error: 'Auto-advance operation already in progress', in_progress: true },
          { status: 409 }
        );
      }

      console.error('Error advancing to next video:', error);
      return NextResponse.json(
        { error: 'Failed to advance to next video' },
        { status: 500 }
      );
    }

    // Fetch updated stream state for response
    const { data: streamData } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    return NextResponse.json({
      success: true,
      stream: streamData,
      advanced_to: {
        playback_id: data.playback_id,
        title: data.title,
        kind: data.kind,
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

