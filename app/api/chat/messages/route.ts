import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  MESSAGE_REACTIONS,
  isMessageReaction,
  type MessageReaction,
  type MessageReactionSummary,
} from '@/lib/reactions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ReactionRow = {
  message_id: number;
  user_id: string;
  reaction: string;
};

function withReactionSummaries<T extends { id: number }>(
  messages: T[],
  rows: ReactionRow[],
  viewerId: string
) {
  const grouped = new Map<number, ReactionRow[]>();

  for (const row of rows) {
    if (!isMessageReaction(row.reaction)) continue;

    const current = grouped.get(row.message_id) || [];
    current.push(row);
    grouped.set(row.message_id, current);
  }

  return messages.map((message) => {
    const messageRows = grouped.get(message.id) || [];
    const counts = new Map<MessageReaction, number>();
    let viewerReaction: MessageReaction | null = null;

    for (const row of messageRows) {
      const reaction = row.reaction as MessageReaction;
      counts.set(reaction, (counts.get(reaction) || 0) + 1);

      if (viewerId && row.user_id === viewerId) {
        viewerReaction = reaction;
      }
    }

    const reactions: MessageReactionSummary[] = MESSAGE_REACTIONS
      .map((reaction) => ({
        reaction,
        count: counts.get(reaction) || 0,
        viewerReacted: viewerReaction === reaction,
      }))
      .filter((reaction) => reaction.count > 0);

    return {
      ...message,
      reactions,
      viewerReaction,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room') || 'event';
    const limit = parseInt(searchParams.get('limit') || '100');
    const viewerId = searchParams.get('userId') || '';

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room', room)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Reverse to get chronological order
    const sortedMessages = (messages || []).reverse();
    const messageIds = sortedMessages.map((message) => message.id);

    let reactionRows: ReactionRow[] = [];
    if (messageIds.length > 0) {
      const { data: reactions, error: reactionError } = await supabaseAdmin
        .from('message_reactions')
        .select('message_id, user_id, reaction')
        .in('message_id', messageIds);

      if (reactionError) {
        console.warn('Message reactions unavailable:', reactionError.message);
      } else {
        reactionRows = reactions || [];
      }
    }

    const messagesWithReactions = withReactionSummaries(
      sortedMessages,
      reactionRows,
      viewerId
    );

    return NextResponse.json(
      { messages: messagesWithReactions },
      {
        headers: {
          // Mobile browsers heuristically cache GETs without this, serving a
          // stale message list when the chat refetches after a reconnect.
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
