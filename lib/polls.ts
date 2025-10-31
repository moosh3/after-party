import { supabaseAdmin } from './supabase-admin';

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  idx: number;
  vote_count?: number;
  percentage?: number;
  voters?: string[]; // Display names of voters (for admin view)
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

export async function getAllPolls(
  room: string = 'event',
  userId?: string
): Promise<PollData[]> {
  try {
    // Fetch all polls for the room
    const { data: polls, error: pollsError } = await supabaseAdmin
      .from('polls')
      .select('*')
      .eq('room', room)
      .order('created_at', { ascending: false });

    if (pollsError || !polls) {
      console.error('Failed to fetch polls:', pollsError);
      return [];
    }

    // Fetch all polls data with results
    const pollsWithResults = await Promise.all(
      polls.map(async (poll) => {
        const results = await getPollResults(poll.id, userId);
        return results;
      })
    );

    // Filter out any nulls
    return pollsWithResults.filter((poll) => poll !== null) as PollData[];
  } catch (error) {
    console.error('Failed to get all polls:', error);
    return [];
  }
}

export async function updatePollQuestion(
  pollId: string,
  newQuestion: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newQuestion || newQuestion.trim().length === 0) {
      return { success: false, error: 'Question cannot be empty' };
    }

    if (newQuestion.length > 300) {
      return { success: false, error: 'Question too long (max 300 characters)' };
    }

    // Check if poll exists and is open
    const { data: poll, error: fetchError } = await supabaseAdmin
      .from('polls')
      .select('is_open')
      .eq('id', pollId)
      .single();

    if (fetchError || !poll) {
      return { success: false, error: 'Poll not found' };
    }

    if (!poll.is_open) {
      return { success: false, error: 'Cannot edit a closed poll' };
    }

    // Update the question
    const { error: updateError } = await supabaseAdmin
      .from('polls')
      .update({ question: newQuestion.trim() })
      .eq('id', pollId);

    if (updateError) {
      console.error('Failed to update poll question:', updateError);
      return { success: false, error: 'Failed to update poll' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating poll question:', error);
    return { success: false, error: 'Internal error' };
  }
}

export async function deletePoll(pollId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete poll (cascade will handle votes and options)
    const { error } = await supabaseAdmin
      .from('polls')
      .delete()
      .eq('id', pollId);

    if (error) {
      console.error('Failed to delete poll:', error);
      return { success: false, error: 'Failed to delete poll' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting poll:', error);
    return { success: false, error: 'Internal error' };
  }
}

export interface DetailedVoteResult {
  option_id: string;
  option_label: string;
  voters: string[];
  vote_count: number;
}

export async function getDetailedVoteResults(
  pollId: string
): Promise<{ 
  poll: PollData | null; 
  detailedResults: DetailedVoteResult[] 
} | null> {
  try {
    // First get the poll data
    const poll = await getPollResults(pollId);
    
    if (!poll) {
      return null;
    }

    // Fetch all votes with user names
    const { data: votes, error: votesError } = await supabaseAdmin
      .from('poll_votes')
      .select('option_id, user_name')
      .eq('poll_id', pollId)
      .order('user_name', { ascending: true });

    if (votesError) {
      console.error('Failed to fetch detailed votes:', votesError);
      return null;
    }

    // Group votes by option
    const votesByOption: Record<string, string[]> = {};
    
    votes?.forEach((vote) => {
      if (!votesByOption[vote.option_id]) {
        votesByOption[vote.option_id] = [];
      }
      votesByOption[vote.option_id].push(vote.user_name);
    });

    // Create detailed results
    const detailedResults: DetailedVoteResult[] = poll.options.map((option) => ({
      option_id: option.id,
      option_label: option.label,
      voters: votesByOption[option.id] || [],
      vote_count: (votesByOption[option.id] || []).length,
    }));

    return {
      poll,
      detailedResults,
    };
  } catch (error) {
    console.error('Failed to get detailed vote results:', error);
    return null;
  }
}

