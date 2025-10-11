import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/session';
import { createPollMessage } from '@/lib/polls';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { room = 'event', question, options } = await request.json();

    // Validate inputs
    if (!question || !options || !Array.isArray(options)) {
      return NextResponse.json(
        { error: 'question and options array are required' },
        { status: 400 }
      );
    }

    if (question.length > 300) {
      return NextResponse.json(
        { error: 'Question too long (max 300 characters)' },
        { status: 400 }
      );
    }

    if (options.length < 2 || options.length > 5) {
      return NextResponse.json(
        { error: 'Must provide between 2 and 5 options' },
        { status: 400 }
      );
    }

    // Validate each option
    for (const option of options) {
      if (typeof option !== 'string' || option.trim().length === 0) {
        return NextResponse.json(
          { error: 'All options must be non-empty strings' },
          { status: 400 }
        );
      }
      if (option.length > 100) {
        return NextResponse.json(
          { error: 'Option too long (max 100 characters)' },
          { status: 400 }
        );
      }
    }

    // Create poll
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .insert({
        room,
        question: question.trim(),
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

    // Create poll options
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

