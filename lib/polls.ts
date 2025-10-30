import { supabaseAdmin } from './supabase-admin';

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  idx: number;
  vote_count?: number;
  percentage?: number;
}

export interface PollData {
  id: string;
  room: string;
  question: string;
  is_open: boolean;
  created_by: string;
  created_at: string;
  closed_at: string | null;
  options: PollOption[];
  total_votes: number;
  user_vote?: string; // option_id user voted for
}

export async function createPollMessage(
  room: string,
  pollId: string
): Promise<void> {
  try {
    await supabaseAdmin.from('messages').insert({
      room,
      user_id: 'system',
      user_name: 'System',
      kind: 'poll',
      body: pollId, // Store poll ID in message body
    });
  } catch (error) {
    console.error('Failed to create poll message:', error);
    throw error;
  }
}

export async function getPollResults(
  pollId: string,
  userId?: string
): Promise<PollData | null> {
  try {
    // Fetch poll details
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (pollError || !poll) {
      console.error('Failed to fetch poll:', pollError);
      return null;
    }

    // Fetch poll options
    const { data: options, error: optionsError } = await supabaseAdmin
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)
      .order('idx', { ascending: true });

    if (optionsError) {
      console.error('Failed to fetch poll options:', optionsError);
      return null;
    }

    // Fetch all votes for this poll
    const { data: votes, error: votesError } = await supabaseAdmin
      .from('poll_votes')
      .select('option_id, user_id')
      .eq('poll_id', pollId);

    if (votesError) {
      console.error('Failed to fetch votes:', votesError);
      return null;
    }

    // Calculate vote counts per option
    const voteCounts: Record<string, number> = {};
    let userVote: string | undefined;

    votes?.forEach((vote) => {
      voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
      if (userId && vote.user_id === userId) {
        userVote = vote.option_id;
      }
    });

    const totalVotes = votes?.length || 0;

    // Add vote counts and percentages to options
    const optionsWithVotes: PollOption[] = (options || []).map((option) => ({
      ...option,
      vote_count: voteCounts[option.id] || 0,
      percentage:
        totalVotes > 0
          ? Math.round(((voteCounts[option.id] || 0) / totalVotes) * 100)
          : 0,
    }));

    return {
      ...poll,
      options: optionsWithVotes,
      total_votes: totalVotes,
      user_vote: userVote,
    };
  } catch (error) {
    console.error('Failed to get poll results:', error);
    return null;
  }
}

export async function announcePollResults(
  room: string,
  pollId: string
): Promise<void> {
  try {
    const results = await getPollResults(pollId);
    if (!results) return;

    // Find winning option(s)
    const maxVotes = Math.max(
      ...results.options.map((opt) => opt.vote_count || 0)
    );
    const winners = results.options.filter(
      (opt) => opt.vote_count === maxVotes
    );

    let message = `Poll "${results.question}" has closed. `;
    if (results.total_votes === 0) {
      message += 'No votes were cast.';
    } else if (winners.length === 1) {
      message += `Winner: "${winners[0].label}" with ${maxVotes} vote${
        maxVotes !== 1 ? 's' : ''
      } (${winners[0].percentage}%)`;
    } else {
      message += `Tie between: ${winners
        .map((w) => `"${w.label}"`)
        .join(', ')} with ${maxVotes} vote${maxVotes !== 1 ? 's' : ''} each`;
    }

    // Send system message
    await supabaseAdmin.from('messages').insert({
      room,
      user_id: 'system',
      user_name: 'System',
      kind: 'system',
      body: message,
    });
  } catch (error) {
    console.error('Failed to announce poll results:', error);
  }
}

