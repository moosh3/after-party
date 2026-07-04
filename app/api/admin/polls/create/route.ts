import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/session';
import { createPollMessage } from '@/lib/polls';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { room = 'event', question, options, type = 'fixed' } = await request.json();

    if (type !== 'fixed' && type !== 'open') {
      return NextResponse.json(
        { error: "type must be 'fixed' or 'open'" },
        { status: 400 }
      );
    }

    // Validate inputs
    if (!question) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      );
    }

    if (question.length > 300) {
      return NextResponse.json(
        { error: 'Question too long (max 300 characters)' },
        { status: 400 }
      );
    }

    // Fixed polls need admin-authored options up front; open polls start
    // empty and viewers submit their own answers via /api/polls/answer.
    if (type === 'fixed') {
      if (!options || !Array.isArray(options)) {
        return NextResponse.json(
          { error: 'options array is required for fixed polls' },
          { status: 400 }
        );
      }

      if (options.length < 2 || options.length > 5) {
        return NextResponse.json(
          { error: 'Must provide between 2 and 5 options' },
          { status: 400 }
        );
      }

      for (const option of options) {
        if (typeof option !== 'string' || option.trim().length === 0) {
          return NextResponse.json(
            { error: 'All options must be non-empty strings' },
            { status: 400 }
          );
        }
        if (option.length > 280) {
          return NextResponse.json(
            { error: 'Option too long (max 280 characters)' },
            { status: 400 }
          );
        }
      }
    }

    // Create poll
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .insert({
        room,
        question: question.trim(),
        type,
        is_open: true,
        created_by: session.userId,
      })
      .select()
      .single();

    if (pollError || !poll) {
      console.error('Failed to create poll:', pollError);
      return NextResponse.json(
        { error: 'Failed to create poll' },
        { status: 500 }
      );
    }

    // Create poll options (fixed polls only — open polls start with none)
    if (type === 'fixed') {
      const optionInserts = options.map((label: string, idx: number) => ({
        poll_id: poll.id,
        label: label.trim(),
        idx,
      }));

      const { error: optionsError } = await supabaseAdmin
        .from('poll_options')
        .insert(optionInserts);

      if (optionsError) {
        console.error('Failed to create poll options:', optionsError);
        // Rollback: delete the poll
        await supabaseAdmin.from('polls').delete().eq('id', poll.id);
        return NextResponse.json(
          { error: 'Failed to create poll options' },
          { status: 500 }
        );
      }
    }

    // Create poll message in chat
    await createPollMessage(room, poll.id);

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'poll_create',
      admin_user: session.userId,
      details: { poll_id: poll.id, question },
    });

    return NextResponse.json(
      {
        success: true,
        poll: {
          id: poll.id,
          question: poll.question,
          room: poll.room,
          is_open: poll.is_open,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

