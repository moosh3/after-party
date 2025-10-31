'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PollData, PollOption } from '@/lib/polls';

interface PollCardProps {
  pollId: string;
  userId: string;
  room: string;
}

export default function PollCard({ pollId, userId }: PollCardProps) {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial poll data
  useEffect(() => {
    async function loadPoll() {
      try {
        const response = await fetch(`/api/polls/${pollId}?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setPoll(data.poll);
        } else {
          setError('Failed to load poll');
        }
      } catch (err) {
        console.error('Failed to load poll:', err);
        setError('Failed to load poll');
      } finally {
        setLoading(false);
      }
    }

    loadPoll();
  }, [pollId, userId]);

  // Subscribe to vote updates
  useEffect(() => {
    const channel = supabase
      .channel(`poll-votes:${pollId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
          filter: `poll_id=eq.${pollId}`,
        },
        async () => {
          // Refetch poll data when votes change
          try {
            const response = await fetch(`/api/polls/${pollId}?userId=${userId}`);
            if (response.ok) {
              const data = await response.json();
              setPoll(data.poll);
            }
          } catch (err) {
            console.error('Failed to update poll:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, userId]);

  // Subscribe to poll updates (for closing)
  useEffect(() => {
    const channel = supabase
      .channel(`poll:${pollId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'polls',
          filter: `id=eq.${pollId}`,
        },
        async () => {
          // Refetch poll data when poll is updated (closed)
          try {
            const response = await fetch(`/api/polls/${pollId}?userId=${userId}`);
            if (response.ok) {
              const data = await response.json();
              setPoll(data.poll);
            }
          } catch (err) {
            console.error('Failed to update poll:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, userId]);

  async function handleVote(optionId: string) {
    if (!poll?.is_open || voting) return;

    setVoting(true);
    setError(null);

    try {
      const response = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId,
          optionId,
          userId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to vote');
      }
      // Don't need to update state here - Realtime will handle it
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Vote error:', err);
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <div className="twitch-card p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-twitch-hover rounded w-3/4 mb-3"></div>
          <div className="space-y-2">
            <div className="h-10 bg-twitch-hover rounded"></div>
            <div className="h-10 bg-twitch-hover rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="twitch-card p-4">
        <p className="text-error text-sm">{error || 'Poll not available'}</p>
      </div>
    );
  }

  const maxVotes = Math.max(...poll.options.map((opt) => opt.vote_count || 0));
  const winners = poll.options.filter((opt) => opt.vote_count === maxVotes);
  const isWinner = (option: PollOption) =>
    poll.total_votes > 0 && winners.some((w) => w.id === option.id);

  return (
    <div className={`twitch-card p-4 space-y-3 ${poll.is_open ? 'border border-twitch-purple' : 'border-2 border-success/50 bg-gradient-to-br from-twitch-dark to-twitch-darker'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`twitch-badge ${!poll.is_open && 'bg-success/20 text-success'}`}>
              {poll.is_open ? 'Poll' : '🏆 Poll Closed'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-twitch-text">{poll.question}</h3>
          {!poll.is_open && poll.total_votes > 0 && (
            <p className="text-xs text-success font-semibold mt-2">
              Winner{winners.length > 1 ? 's' : ''}: {winners.map(w => w.label).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isVoted = poll.user_vote === option.id;
          const canVote = poll.is_open && !voting;

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={!canVote}
              className={`w-full text-left rounded p-3 transition-all ${
                canVote
                  ? 'hover:bg-twitch-hover cursor-pointer'
                  : 'cursor-default'
              } ${
                isVoted
                  ? 'ring-2 ring-twitch-purple bg-twitch-hover'
                  : 'bg-twitch-darker'
              } ${
                !poll.is_open && 'opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-sm font-medium truncate ${isWinner(option) && !poll.is_open ? 'text-success font-bold' : 'text-twitch-text'}`}>
                    {option.label}
                  </span>
                  {isVoted && poll.is_open && (
                    <span className="text-xs text-twitch-purple">✓</span>
                  )}
                  {isWinner(option) && poll.is_open && (
                    <span className="text-xs font-semibold text-success flex-shrink-0">
                      🏆 Leading
                    </span>
                  )}
                  {isWinner(option) && !poll.is_open && (
                    <span className="text-xs font-bold text-success flex-shrink-0 animate-pulse">
                      🏆 WINNER
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${isWinner(option) && !poll.is_open ? 'text-success font-bold text-base' : 'text-twitch-text'}`}>
                  {option.percentage}%
                </span>
              </div>

              {/* Vote bar */}
              {poll.total_votes > 0 && (
                <div className="w-full bg-twitch-dark rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isWinner(option) && !poll.is_open
                        ? 'bg-gradient-to-r from-yellow-500 to-success'
                        : isWinner(option)
                        ? 'bg-success'
                        : 'bg-twitch-purple'
                    }`}
                    style={{ width: `${option.percentage}%` }}
                  ></div>
                </div>
              )}

              {/* Vote count */}
              <div className="mt-1 text-xs text-twitch-text-alt">
                {option.vote_count || 0} {option.vote_count === 1 ? 'vote' : 'votes'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-twitch-text-alt pt-2 border-t border-twitch-border">
        <span>
          {poll.total_votes} total {poll.total_votes === 1 ? 'vote' : 'votes'}
        </span>
        {poll.user_vote && poll.is_open && (
          <span className="text-twitch-purple">
            You voted • Click to change
          </span>
        )}
        {!poll.is_open && (
          <span className="text-twitch-text-alt">
            Poll closed
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-error pt-2">
          {error}
        </div>
      )}
    </div>
  );
}

