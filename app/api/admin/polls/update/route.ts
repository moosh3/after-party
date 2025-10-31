import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { updatePollQuestion } from '@/lib/polls';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pollId, question } = await request.json();

    if (!pollId || !question) {
      return NextResponse.json(
        { error: 'pollId and question are required' },
        { status: 400 }
      );
    }

    const result = await updatePollQuestion(pollId, question);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update poll' },
        { status: 400 }
      );
    }

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'poll_update',
      admin_user: session.userId,
      details: { poll_id: pollId, new_question: question },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

