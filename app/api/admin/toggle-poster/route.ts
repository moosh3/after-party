import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get current state
    const { data: currentData, error: fetchError } = await supabaseAdmin
      .from('current_stream')
      .select('show_poster')
      .eq('id', 1)
      .single();

    if (fetchError) {
      console.error('Failed to fetch current poster state:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch current state' },
        { status: 500 }
      );
    }

    // Toggle the state
    const newState = !(currentData?.show_poster || false);

    const { error: updateError } = await supabaseAdmin
      .from('current_stream')
      .update({ show_poster: newState })
      .eq('id', 1);

    if (updateError) {
      console.error('Failed to update poster mode:', updateError);
      return NextResponse.json(
        { error: 'Failed to update poster mode' },
        { status: 500 }
      );
    }

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'toggle_poster_mode',
      admin_user: session.userId,
      details: { show_poster: newState },
    });

    return NextResponse.json({ 
      success: true, 
      showPoster: newState 
    });
  } catch (error) {
    console.error('Error toggling poster mode:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

