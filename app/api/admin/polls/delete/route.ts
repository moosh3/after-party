import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { deletePoll } from '@/lib/polls';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    const result = await deletePoll(pollId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete poll' },
        { status: 500 }
      );
    }

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'poll_delete',
      admin_user: session.userId,
      details: { poll_id: pollId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

