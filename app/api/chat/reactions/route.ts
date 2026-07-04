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
  user_id: string;
  reaction: string;
};

function summarizeReactions(rows: ReactionRow[], viewerId: string) {
  const counts = new Map<MessageReaction, number>();
  let viewerReaction: MessageReaction | null = null;

  for (const row of rows) {
    if (!isMessageReaction(row.reaction)) continue;

    counts.set(row.reaction, (counts.get(row.reaction) || 0) + 1);
    if (row.user_id === viewerId) {
      viewerReaction = row.reaction;
    }
  }

  const reactions: MessageReactionSummary[] = MESSAGE_REACTIONS
    .map((reaction) => ({
      reaction,
      count: counts.get(reaction) || 0,
      viewerReacted: viewerReaction === reaction,
    }))
    .filter((reaction) => reaction.count > 0);

  return { reactions, viewerReaction };
}

export async function POST(request: NextRequest) {
  try {
    const { messageId, userId, userName, reaction } = await request.json();
    const numericMessageId = Number(messageId);

    if (!Number.isInteger(numericMessageId) || numericMessageId <= 0) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 401 }
      );
    }

    if (!isMessageReaction(reaction)) {
      return NextResponse.json(
        { error: 'Invalid reaction' },
        { status: 400 }
      );
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select('id, kind, deleted_at')
      .eq('id', numericMessageId)
      .single();

    if (messageError || !message || message.deleted_at) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.kind !== 'user') {
      return NextResponse.json(
        { error: 'Only chat messages can be reacted to' },
        { status: 400 }
      );
    }

    const { data: existingReaction, error: existingError } = await supabaseAdmin
      .from('message_reactions')
      .select('reaction')
      .eq('message_id', numericMessageId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      console.error('Failed to load existing reaction:', existingError);
      return NextResponse.json(
        { error: 'Reactions are not set up yet' },
        { status: 500 }
      );
    }

    if (existingReaction?.reaction === reaction) {
      const { error: deleteError } = await supabaseAdmin
        .from('message_reactions')
        .delete()
        .eq('message_id', numericMessageId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Failed to delete reaction:', deleteError);
        return NextResponse.json(
          { error: 'Failed to remove reaction' },
          { status: 500 }
        );
      }
    } else {
      const { error: upsertError } = await supabaseAdmin
        .from('message_reactions')
        .upsert(
          {
            message_id: numericMessageId,
            user_id: userId,
            user_name: typeof userName === 'string' && userName.trim()
              ? userName.trim().slice(0, 80)
              : 'Guest',
            reaction,
          },
          { onConflict: 'message_id,user_id' }
        );

      if (upsertError) {
        console.error('Failed to save reaction:', upsertError);
        return NextResponse.json(
          { error: 'Failed to save reaction' },
          { status: 500 }
        );
      }
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('message_reactions')
      .select('user_id, reaction')
      .eq('message_id', numericMessageId);

    if (rowsError) {
      console.error('Failed to load reaction summary:', rowsError);
      return NextResponse.json(
        { error: 'Reaction saved, but failed to refresh counts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: numericMessageId,
      ...summarizeReactions(rows || [], userId),
    });
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
