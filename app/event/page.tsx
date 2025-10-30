'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import Chat from '@/components/Chat';
import PollCard from '@/components/PollCard';
import ViewerRegistration from '@/components/ViewerRegistration';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { useStreamUpdates } from '@/hooks/useStreamUpdates';
import { supabase } from '@/lib/supabase';
import { getViewerData } from '@/lib/viewer';

interface StreamData {
  playbackId: string;
  token: string;
  expiresAt: string;
  title: string;
  kind: string;
}

interface PollData {
  id: string;
  question: string;
  is_open: boolean;
}

export default function EventPage() {
  const router = useRouter();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [activePolls, setActivePolls] = useState<PollData[]>([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);

  // Token refresh hook
  useTokenRefresh(streamData, setStreamData);

  // Stream updates hook
  const updatedStream = useStreamUpdates(
    streamData ? {
      playbackId: streamData.playbackId,
      title: streamData.title,
      kind: streamData.kind,
      updatedAt: new Date().toISOString(),
    } : null
  );

  // Handle stream updates
  useEffect(() => {
    if (!updatedStream || !streamData) return;

    // Check if stream changed
    if (updatedStream.playbackId !== streamData.playbackId) {
      console.log('Stream changed, fetching new token...');
      
      // Fetch new stream data with token
      fetch('/api/current')
        .then(res => res.json())
        .then(data => {
          setStreamData(data);
        })
        .catch(err => {
          console.error('Failed to fetch updated stream:', err);
        });
    }
  }, [updatedStream, streamData]);

  // Check if viewer is registered
  useEffect(() => {
    const viewerData = getViewerData();
    if (viewerData) {
      setIsRegistered(true);
      setUserId(viewerData.id);
    }
    setCheckingRegistration(false);
  }, []);

  useEffect(() => {
    // Only load stream if registered
    if (!isRegistered) return;

    async function loadStream() {
      try {
        const response = await fetch('/api/current');

        if (response.status === 401) {
          router.push('/');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load stream');
        }

        const data = await response.json();
        setStreamData(data);
      } catch (err) {
        setError('Failed to load event. Please try again.');
        console.error('Error loading stream:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStream();
  }, [router, isRegistered]);

  // Load active polls
  useEffect(() => {
    async function loadActivePolls() {
      try {
        const { data, error } = await supabase
          .from('polls')
          .select('id, question, is_open')
          .eq('is_open', true)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setActivePolls(data);
        }
      } catch (err) {
        console.error('Failed to load polls:', err);
      }
    }

    loadActivePolls();

    // Subscribe to poll changes
    const channel = supabase
      .channel('active-polls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
        },
        () => {
          loadActivePolls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Show registration form if not registered
  if (checkingRegistration) {
    return (
      <div className="min-h-screen bg-twitch-darker flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/assets/logos/alecmklogo.png" 
            alt="After Party Logo" 
            className="h-20 w-20 rounded-full object-cover mx-auto mb-4 shadow-lg"
          />
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-twitch-purple mx-auto mb-4"></div>
          <p className="text-twitch-text-alt">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div 
        className="min-h-screen bg-twitch-darker flex items-center justify-center p-4"
        style={{
          backgroundImage: 'url(/assets/backgrounds/background_.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto'
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div className="relative z-10">
          <ViewerRegistration onComplete={() => {
            const viewerData = getViewerData();
            if (viewerData) {
              setUserId(viewerData.id);
              setIsRegistered(true);
            }
          }} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-twitch-darker flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/assets/logos/alecmklogo.png" 
            alt="After Party Logo" 
            className="h-20 w-20 rounded-full object-cover mx-auto mb-4 shadow-lg"
          />
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-twitch-purple mx-auto mb-4"></div>
          <p className="text-twitch-text-alt">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="min-h-screen bg-twitch-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-error mb-4">{error || 'No stream available'}</p>
          <button
            onClick={() => window.location.reload()}
            className="twitch-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-twitch-darker text-twitch-text flex flex-col">
      {/* Stream info bar */}
      <div className="bg-twitch-dark border-b border-twitch-border px-4 py-3">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/logos/alecmklogo.png" 
            alt="Channel Avatar" 
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <h2 className="text-lg font-semibold">{streamData.title}</h2>
            <p className="text-sm text-twitch-text-alt">After Party Movie Marathon</p>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 flex">
        {/* Video Player - Takes most of the width */}
        <div className="flex-1 bg-black flex flex-col">
          <VideoPlayer
            key={streamData.playbackId}
            playbackId={streamData.playbackId}
            token={streamData.token}
            title={streamData.title}
          />
          
          {/* Welcome Message & Links */}
          <div className="bg-gradient-to-b from-twitch-dark to-twitch-gray border-t border-twitch-border px-4 py-3">
            {/* Welcome Title with Scary Font */}
            <h2 
              className="text-2xl text-center mb-3 text-red-600"
              style={{ 
                fontFamily: 'Scary, serif',
                textShadow: '0 0 20px rgba(220, 38, 38, 0.6), 0 0 40px rgba(220, 38, 38, 0.4)',
                letterSpacing: '0.05em'
              }}
            >
              WELCOME TO THE AFTER PARTY MOVIE MARATHON
            </h2>
            
            {/* Styled Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <a 
                href="https://alecandmk.wedding/online" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105"
              >
                <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500 hover:border-cyan-300 rounded-lg px-3 py-3 text-center transition-all duration-300 shadow-lg hover:shadow-cyan-500/50">
                  <div 
                    className="text-lg md:text-xl font-black text-black uppercase tracking-wide relative whitespace-nowrap"
                    style={{ 
                      fontFamily: 'Scary, serif',
                      textShadow: '2px 2px 0 #0891b2, 3px 3px 6px rgba(0, 0, 0, 0.8)',
                      WebkitTextStroke: '1px #0891b2'
                    }}
                  >
                    WATCH ONLINE
                  </div>
                </div>
              </a>
              
              <a 
                href="https://alecandmk.wedding/theweddingparty-photos/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105"
              >
                <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500 hover:border-cyan-300 rounded-lg px-3 py-3 text-center transition-all duration-300 shadow-lg hover:shadow-cyan-500/50">
                  <div 
                    className="text-lg md:text-xl font-black text-black uppercase tracking-wide relative whitespace-nowrap"
                    style={{ 
                      fontFamily: 'Scary, serif',
                      textShadow: '2px 2px 0 #0891b2, 3px 3px 6px rgba(0, 0, 0, 0.8)',
                      WebkitTextStroke: '1px #0891b2'
                    }}
                  >
                    PHOTOS
                  </div>
                </div>
              </a>
              
              <a 
                href="https://alecandmk.wedding/trip" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105"
              >
                <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500 hover:border-cyan-300 rounded-lg px-3 py-3 text-center transition-all duration-300 shadow-lg hover:shadow-cyan-500/50">
                  <div 
                    className="text-lg md:text-xl font-black text-black uppercase tracking-wide relative whitespace-nowrap"
                    style={{ 
                      fontFamily: 'Scary, serif',
                      textShadow: '2px 2px 0 #0891b2, 3px 3px 6px rgba(0, 0, 0, 0.8)',
                      WebkitTextStroke: '1px #0891b2'
                    }}
                  >
                    TRIP INFO
                  </div>
                </div>
              </a>
              
              <a 
                href="https://alecandmk.wedding/celebrate" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105"
              >
                <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500 hover:border-cyan-300 rounded-lg px-3 py-3 text-center transition-all duration-300 shadow-lg hover:shadow-cyan-500/50">
                  <div 
                    className="text-lg md:text-xl font-black text-black uppercase tracking-wide relative whitespace-nowrap"
                    style={{ 
                      fontFamily: 'Scary, serif',
                      textShadow: '2px 2px 0 #0891b2, 3px 3px 6px rgba(0, 0, 0, 0.8)',
                      WebkitTextStroke: '1px #0891b2'
                    }}
                  >
                    CELEBRATE
                  </div>
                </div>
              </a>
            </div>
          </div>

          {/* Active Polls Section */}
          {activePolls.length > 0 && (
            <div className="bg-gradient-to-b from-twitch-gray to-black border-t-4 border-red-600 px-4 py-4">
              {/* Polls Header */}
              <div className="text-center mb-4">
                <h3 
                  className="text-3xl text-red-600 inline-block relative"
                  style={{ 
                    fontFamily: 'Scary, serif',
                    textShadow: '0 0 20px rgba(220, 38, 38, 0.8), 3px 3px 0 #0891b2, 6px 6px 10px rgba(0, 0, 0, 0.9)',
                    WebkitTextStroke: '1.5px #0891b2',
                    letterSpacing: '0.1em'
                  }}
                >
                  🗳️ VOTE NOW! 🗳️
                </h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="h-1 w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent animate-pulse"></div>
                  <span className="text-xs uppercase tracking-wider text-twitch-text-alt font-bold">
                    {activePolls.length} Active {activePolls.length === 1 ? 'Poll' : 'Polls'}
                  </span>
                  <div className="h-1 w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent animate-pulse"></div>
                </div>
              </div>

              {/* Polls Grid */}
              <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto pr-2">
                {activePolls.map((poll) => (
                  <div 
                    key={poll.id}
                    className="relative"
                  >
                    {/* Dramatic border effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-purple-600 to-cyan-500 rounded-xl blur opacity-50 animate-pulse"></div>
                    
                    {/* Poll Card Container */}
                    <div className="relative bg-twitch-dark rounded-xl border-2 border-cyan-500 overflow-hidden">
                      <PollCard 
                        pollId={poll.id} 
                        userId={userId}
                        room="event"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Sidebar - Fixed width on desktop */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <Chat room="event" userId={userId} />
        </div>
      </main>
    </div>
  );
}

