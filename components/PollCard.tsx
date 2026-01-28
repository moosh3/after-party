'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PollData, PollOption } from '@/lib/polls';
import { getViewerData } from '@/lib/viewer';

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
      // Get viewer data to include userName
      const viewerData = getViewerData();
      const userName = viewerData?.displayName || 'Anonymous';

      const response = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollId,
          optionId,
          userId,
          userName,
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
          <div className="h-4 bg-white/20 rounded w-3/4 mb-3"></div>
          <div className="space-y-2">
            <div className="h-10 bg-white/20 rounded-xl"></div>
            <div className="h-10 bg-white/20 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="twitch-card p-4">
        <p className="text-red-400 text-sm">{error || 'Poll not available'}</p>
      </div>
    );
  }

  const maxVotes = Math.max(...poll.options.map((opt) => opt.vote_count || 0));
  const winners = poll.options.filter((opt) => opt.vote_count === maxVotes);
  const isWinner = (option: PollOption) =>
    poll.total_votes > 0 && winners.some((w) => w.id === option.id);

  return (
    <div className={`twitch-card p-4 space-y-3 ${poll.is_open ? 'border-2 border-casual-yellow/50' : 'border-2 border-emerald-400/50'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`twitch-badge ${!poll.is_open && 'bg-emerald-400/20 text-emerald-400'}`}>
              {poll.is_open ? 'Vote Now' : 'Closed'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white">{poll.question}</h3>
          {!poll.is_open && poll.total_votes > 0 && (
            <p className="text-xs text-emerald-400 font-semibold mt-2">
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
              className={`w-full text-left rounded-xl p-3 transition-all ${
                canVote
                  ? 'hover:bg-white/20 cursor-pointer'
                  : 'cursor-default'
              } ${
                isVoted
                  ? 'ring-2 ring-casual-yellow bg-casual-yellow/20'
                  : 'bg-white/10'
              } ${
                !poll.is_open && 'opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-sm font-medium truncate ${isWinner(option) && !poll.is_open ? 'text-emerald-400 font-bold' : 'text-white'}`}>
                    {option.label}
                  </span>
                  {isVoted && poll.is_open && (
                    <span className="text-xs text-casual-yellow">Your vote</span>
                  )}
                  {isWinner(option) && poll.is_open && (
                    <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">
                      Leading
                    </span>
                  )}
                  {isWinner(option) && !poll.is_open && (
                    <span className="text-xs font-bold text-emerald-400 flex-shrink-0 animate-pulse">
                      WINNER
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${isWinner(option) && !poll.is_open ? 'text-emerald-400 font-bold text-base' : 'text-white'}`}>
                  {option.percentage}%
                </span>
              </div>

              {/* Vote bar */}
              {poll.total_votes > 0 && (
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isWinner(option) && !poll.is_open
                        ? 'bg-gradient-to-r from-casual-yellow to-emerald-400'
                        : isWinner(option)
                        ? 'bg-emerald-400'
                        : 'bg-casual-blue'
                    }`}
                    style={{ width: `${option.percentage}%` }}
                  ></div>
                </div>
              )}

              {/* Vote count */}
              <div className="mt-1 text-xs text-white/60">
                {option.vote_count || 0} {option.vote_count === 1 ? 'vote' : 'votes'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-white/60 pt-2 border-t border-white/20">
        <span>
          {poll.total_votes} total {poll.total_votes === 1 ? 'vote' : 'votes'}
        </span>
        {poll.user_vote && poll.is_open && (
          <span className="text-casual-yellow">
            You voted - Click to change
          </span>
        )}
        {!poll.is_open && (
          <span className="text-white/50">
            Poll closed
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 pt-2">
          {error}
        </div>
      )}
    </div>
  );
}

