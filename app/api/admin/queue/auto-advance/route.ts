import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

// GET - Get current auto-advance status
export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('auto_advance_enabled')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching auto-advance status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch auto-advance status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      auto_advance_enabled: data?.auto_advance_enabled || false 
    });
  } catch (error) {
    console.error('Error fetching auto-advance status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Toggle auto-advance on/off
export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { enabled } = await request.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled (boolean) is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .update({ auto_advance_enabled: enabled })
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('Error updating auto-advance:', error);
      return NextResponse.json(
        { error: 'Failed to update auto-advance setting' },
        { status: 500 }
      );
    }

    // Log admin action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'auto_advance_toggle',
      admin_user: session.userId,
      details: { enabled },
    });

    return NextResponse.json({ 
      success: true, 
      auto_advance_enabled: data.auto_advance_enabled 
    });
  } catch (error) {
    console.error('Error toggling auto-advance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

