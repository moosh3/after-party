import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/session';
import { announcePollResults } from '@/lib/polls';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pollId } = await request.json();

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    // Fetch poll to get room
    const { data: poll, error: fetchError } = await supabaseAdmin
      .from('polls')
      .select('room, is_open')
      .eq('id', pollId)
      .single();

    if (fetchError || !poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    if (!poll.is_open) {
      return NextResponse.json(
        { error: 'Poll is already closed' },
        { status: 400 }
      );
    }

    // Close poll
    const { error: updateError } = await supabaseAdmin
      .from('polls')
      .update({
        is_open: false,
        closed_at: new Date().toISOString(),
      })
      .eq('id', pollId);

    if (updateError) {
      console.error('Failed to close poll:', updateError);
      return NextResponse.json(
        { error: 'Failed to close poll' },
        { status: 500 }
      );
    }

    // Announce results in chat
    await announcePollResults(poll.room, pollId);

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'poll_close',
      admin_user: session.userId,
      details: { poll_id: pollId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error closing poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

