'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PollCard from './PollCard';

interface PollData {
  id: string;
  question: string;
  is_open: boolean;
  created_at: string;
  closed_at: string | null;
  total_votes: number;
  options: {
    id: string;
    label: string;
    vote_count: number;
    percentage: number;
  }[];
}

interface PollsTabProps {
  userId: string;
  room?: string;
}

export default function PollsTab({ userId, room = 'event' }: PollsTabProps) {
  const [polls, setPolls] = useState<PollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');

  useEffect(() => {
    loadPolls();

    // Subscribe to poll changes
    const channel = supabase
      .channel('polls-tab')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
        },
        () => {
          loadPolls();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poll_votes',
        },
        () => {
          loadPolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, userId]);

  async function loadPolls() {
    try {
      const response = await fetch(`/api/polls?room=${room}&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPolls(data.polls || []);
      }
    } catch (error) {
      console.error('Failed to load polls:', error);
    } finally {
      setLoading(false);
    }
  }

  const activePolls = polls.filter(p => p.is_open);
  const closedPolls = polls.filter(p => !p.is_open);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-twitch-purple"></div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-twitch-text-alt text-sm">No polls yet. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-twitch-border">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-semibold text-sm transition-colors relative ${
            activeTab === 'active'
              ? 'text-twitch-purple'
              : 'text-twitch-text-alt hover:text-twitch-text'
          }`}
        >
          Active Polls
          {activePolls.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-twitch-purple text-white">
              {activePolls.length}
            </span>
          )}
          {activeTab === 'active' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-twitch-purple"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('closed')}
          className={`px-4 py-2 font-semibold text-sm transition-colors relative ${
            activeTab === 'closed'
              ? 'text-twitch-purple'
              : 'text-twitch-text-alt hover:text-twitch-text'
          }`}
        >
          Past Results
          {closedPolls.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-twitch-gray text-twitch-text-alt">
              {closedPolls.length}
            </span>
          )}
          {activeTab === 'closed' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-twitch-purple"></div>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'active' && (
          <>
            {activePolls.length === 0 ? (
              <div className="text-center p-8 twitch-card">
                <p className="text-twitch-text-alt text-sm">No active polls right now.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activePolls.map((poll) => (
                  <PollCard key={poll.id} pollId={poll.id} userId={userId} room={room} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'closed' && (
          <>
            {closedPolls.length === 0 ? (
              <div className="text-center p-8 twitch-card">
                <p className="text-twitch-text-alt text-sm">No past polls to show.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {closedPolls.map((poll) => (
                  <PollCard key={poll.id} pollId={poll.id} userId={userId} room={room} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

