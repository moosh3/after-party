'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import Chat from '@/components/Chat';
import PollsTab from '@/components/PollsTab';
import ViewerRegistration from '@/components/ViewerRegistration';
import EventCountdown from '@/components/EventCountdown';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { useStreamUpdates } from '@/hooks/useStreamUpdates';
import { getViewerData } from '@/lib/viewer';
import { supabase } from '@/lib/supabase';

interface StreamData {
  playbackId: string;
  token: string;
  expiresAt: string;
  title: string;
  kind: string;
  showPoster?: boolean;
  isHoldScreen?: boolean;
}

export default function EventPage() {
  const router = useRouter();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [showPoster, setShowPoster] = useState(false);

  // Token refresh hook
  const tokenRefreshError = useTokenRefresh(streamData, setStreamData);

  // Memoize stream updates input to prevent recreating object on every render
  const streamUpdateInput = useMemo(() => {
    if (!streamData) return null;
    return {
      playbackId: streamData.playbackId,
      title: streamData.title,
      kind: streamData.kind,
      updatedAt: streamData.expiresAt || new Date().toISOString(),
    };
  }, [streamData?.playbackId, streamData?.title, streamData?.kind]);

  // Stream updates hook
  const updatedStream = useStreamUpdates(streamUpdateInput);

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

  // Subscribe to hold screen changes specifically
  useEffect(() => {
    const channel = supabase
      .channel('hold-screen-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'current_stream',
          filter: 'id=eq.1',
        },
        (payload: any) => {
          const newData = payload.new;
          const oldData = payload.old;
          
          // Check if hold_screen_enabled changed
          if (newData.hold_screen_enabled !== oldData.hold_screen_enabled) {
            console.log('Hold screen toggled, refetching stream data...');
            fetch('/api/current')
              .then(res => res.json())
              .then(data => {
                setStreamData(data);
              })
              .catch(err => {
                console.error('Failed to fetch updated stream:', err);
              });
          }
        }
      )
      .subscribe((status) => {
        console.log('Hold screen subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check poster mode and viewer registration
  useEffect(() => {
    async function checkPosterMode() {
      try {
        const response = await fetch('/api/current');
        if (response.ok) {
          const data = await response.json();
          setShowPoster(data.showPoster || false);
        }
      } catch (error) {
        console.error('Failed to check poster mode:', error);
      }
    }

    const viewerData = getViewerData();
    if (viewerData) {
      setIsRegistered(true);
      setUserId(viewerData.id);
    }
    
    checkPosterMode();
    setCheckingRegistration(false);
  }, []);

  // Subscribe to poster mode changes in realtime
  useEffect(() => {
    const channel = supabase
      .channel('poster-mode-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'current_stream',
          filter: 'id=eq.1',
        },
        (payload: any) => {
          console.log('Poster mode updated via Realtime:', payload);
          const newData = payload.new;
          if (newData.show_poster !== undefined) {
            setShowPoster(newData.show_poster);
            console.log('Show poster state changed to:', newData.show_poster);
          }
        }
      )
      .subscribe((status) => {
        console.log('Poster mode subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
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

  // Show registration form if not registered
  if (checkingRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        }}
      >
        <div className="text-center">
          <img 
            src="/assets/logos/icon.jpg" 
            alt="Da Movies Logo" 
            className="h-20 w-20 rounded-full object-cover mx-auto mb-4 shadow-lg ring-4 ring-casual-yellow"
          />
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-casual-yellow mx-auto mb-4"></div>
          <p className="text-white/80">Loading...</p>
        </div>
      </div>
    );
  }

  // Show poster mode if enabled
  if (showPoster && !isRegistered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        }}
      >
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center gap-8">
          {/* Retro TV Frame with Banner */}
          <div className="tv-frame w-full">
            <div className="tv-screen">
              <img 
                src="/assets/images/banner.jpeg" 
                alt="Movie Marathon Schedule" 
                className="w-full h-auto"
              />
            </div>
            {/* TV Controls */}
            <div className="tv-controls">
              <div className="tv-button"></div>
              <div className="flex gap-1">
                <div className="tv-button"></div>
                <div className="tv-button"></div>
              </div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 h-3 bg-gray-600 rounded-sm"></div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="w-full max-w-2xl">
            <EventCountdown />
          </div>
        </div>
      </div>
    );
  }

  // Show registration form if poster is disabled
  if (!isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        }}
      >
        <ViewerRegistration onComplete={() => {
          const viewerData = getViewerData();
          if (viewerData) {
            setUserId(viewerData.id);
            setIsRegistered(true);
          }
        }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        }}
      >
        <div className="text-center">
          <img 
            src="/assets/logos/icon.jpg" 
            alt="Da Movies Logo" 
            className="h-20 w-20 rounded-full object-cover mx-auto mb-4 shadow-lg ring-4 ring-casual-yellow"
          />
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-casual-yellow mx-auto mb-4"></div>
          <p className="text-white/80">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        }}
      >
        <div className="text-center twitch-card p-8">
          <p className="text-red-400 mb-4">{error || 'No stream available'}</p>
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
    <div className="h-screen text-white flex flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
      }}
    >
      {tokenRefreshError && (
        <div className="bg-casual-yellow/20 border-b border-casual-yellow text-casual-yellow text-sm px-4 py-2 text-center">
          {tokenRefreshError}
        </div>
      )}
      {/* Stream info bar */}
      <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border-b border-white/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/logos/icon.jpg" 
            alt="Channel Avatar" 
            className="h-12 w-12 rounded-full object-cover ring-2 ring-casual-yellow"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">{streamData.title}</h2>
            <p className="text-sm text-white/70">Da Movies - Movie Marathon</p>
          </div>
          <h2 className="text-lg md:text-xl text-casual-yellow font-bold hidden md:block">
            Welcome to the Movie Marathon!
          </h2>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Video Player Section - Takes most of the width */}
        <div className="flex-1 bg-black/30 flex flex-col overflow-hidden min-h-0">
          {/* Video Player - Fixed height to prevent resizing */}
          <div className="flex-shrink-0 bg-black">
            <VideoPlayer
              key={streamData.playbackId}
              playbackId={streamData.playbackId}
              token={streamData.token}
              title={streamData.title}
              isHoldScreen={streamData.isHoldScreen}
            />
          </div>
          
          {/* Scrollable content below video */}
          <div className="flex-1 overflow-y-auto">
            {/* Watch TV Link */}
            <div className="bg-white/10 backdrop-blur-sm border-t border-white/20 px-4 py-3">
              <div className="flex justify-center">
                <a 
                  href="https://www.youtube.com/watch?v=afEFyCvqoOo" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-105"
                >
                  <div className="bg-casual-yellow hover:bg-yellow-300 rounded-xl px-8 py-3 text-center transition-all duration-300 shadow-lg hover:shadow-glow-yellow border border-white/20">
                    <div className="text-base md:text-lg font-bold text-casual-dark uppercase tracking-wide">
                      Watch TV
                    </div>
                  </div>
                </a>
              </div>
            </div>

            {/* Polls Section */}
            <div className="bg-white/5 backdrop-blur-sm border-t-2 border-casual-yellow/50 px-4 py-4">
              {/* Polls Header */}
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-casual-yellow inline-block">
                  Polls
                </h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-casual-yellow to-transparent"></div>
                  <span className="text-xs uppercase tracking-wider text-white/70 font-semibold">
                    Vote & See Results
                  </span>
                  <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-casual-yellow to-transparent"></div>
                </div>
              </div>

              {/* Polls Tab Component */}
              <div className="pb-4">
                <PollsTab userId={userId} room="event" />
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sidebar - Full width on mobile, fixed width on desktop */}
        <div className="w-full h-96 lg:h-auto lg:w-80 xl:w-96 flex-shrink-0">
          <Chat room="event" userId={userId} />
        </div>
      </main>
    </div>
  );
}

