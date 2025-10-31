import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';

// DELETE - Remove specific video from queue
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

    // Get the item's position before deleting
    const { data: itemToDelete, error: fetchError } = await supabaseAdmin
      .from('video_queue')
      .select('position, mux_item_id')
      .eq('id', id)
      .single();

    if (fetchError || !itemToDelete) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      );
    }

    // Delete the item
    const { error: deleteError } = await supabaseAdmin
      .from('video_queue')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting queue item:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete queue item' },
        { status: 500 }
      );
    }

    // Reorder remaining items (shift positions down)
    const { data: remainingItems, error: remainingError } = await supabaseAdmin
      .from('video_queue')
      .select('id, position')
      .gt('position', itemToDelete.position)
      .order('position', { ascending: true });

    if (remainingError) {
      console.error('Error fetching remaining items:', remainingError);
    } else if (remainingItems && remainingItems.length > 0) {
      // Update positions
      const updates = remainingItems.map((item, index) =>
        supabaseAdmin
          .from('video_queue')
          .update({ position: itemToDelete.position + index })
          .eq('id', item.id)
      );

      await Promise.all(updates);
    }

    // Log admin action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'queue_remove',
      admin_user: session.userId,
      details: {
        queue_item_id: id,
        mux_item_id: itemToDelete.mux_item_id,
        old_position: itemToDelete.position,
      },
    });

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

