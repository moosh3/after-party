import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

// DELETE - Remove specific video from queue
// ISSUE #3: Now uses atomic database function for transaction safety
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Queue item ID is required' },
        { status: 400 }
      );
    }

    // ISSUE #3: Use atomic database function for transaction safety
    const { error } = await supabaseAdmin.rpc('delete_from_queue', {
      queue_item_id: id,
      admin_user_id: session.userId,
    });

    if (error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Queue item not found' },
          { status: 404 }
        );
      }

      console.error('Error deleting queue item:', error);
      return NextResponse.json(
        { error: 'Failed to delete queue item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Queue item deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting queue item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

