'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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

  const spawnEasterEmojis = useCallback(() => {
    const emojis = ['🐰', '🥚', '🐣', '🌷', '🐇', '🪺', '🐥', '🌸'];
    const count = 1000;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.cssText = `
        position:fixed;
        left:${Math.random() * 100}vw;
        top:-40px;
        font-size:${20 + Math.random() * 24}px;
        pointer-events:none;
        z-index:9999;
      `;
      document.body.appendChild(el);
      const duration = 2000 + Math.random() * 2000;
      const drift = (Math.random() - 0.5) * 200;
      const spin = (Math.random() - 0.5) * 720;
      const delay = Math.random() * 600;
      el.animate([
        { transform: 'translateY(0) translateX(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(${window.innerHeight + 80}px) translateX(${drift}px) rotate(${spin}deg)`, opacity: 0.6 },
      ], { duration, delay, easing: 'ease-in', fill: 'forwards' });
      setTimeout(() => el.remove(), duration + delay + 100);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('easter-eggs')
      .on('broadcast', { event: 'trigger' }, () => {
        spawnEasterEmojis();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spawnEasterEmojis]);

  // Show registration form if not registered
  if (checkingRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
        }}
      >
        <div className="text-center">
          <img 
            src="/assets/logos/icon.jpg" 
            alt="Da Movies Logo" 
            className="h-20 w-20 rounded-full object-cover mx-auto mb-4 shadow-lg ring-4 ring-casual-pink"
          />
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-casual-pink mx-auto mb-4"></div>
          <p className="text-casual-dark/80">Loading...</p>
        </div>
      </div>
    );
  }

  // Show poster mode if enabled
  if (showPoster && !isRegistered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
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
                  <div key={i} className="w-1 h-3 bg-casual-violet rounded-sm"></div>
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
          background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
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
          background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
        }}
      >
        <div className="text-center">
          <img 
            src="/assets/logos/icon.jpg" 
            alt="Da Movies Logo" 
            className="h-20 w-20 rounded-full object-cover mx-auto mb-4 shadow-lg ring-4 ring-casual-pink"
          />
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-casual-pink mx-auto mb-4"></div>
          <p className="text-casual-dark/80">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
        }}
      >
        <div className="text-center twitch-card p-8">
          <p className="text-red-500 mb-4">{error || 'No stream available'}</p>
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
        background: 'linear-gradient(135deg, #fef08a 0%, #fbcfe8 25%, #c4b5fd 50%, #a5f3fc 75%, #a7f3d0 100%)',
      }}
    >
      {tokenRefreshError && (
        <div className="bg-casual-yellow/20 border-b border-casual-yellow text-casual-yellow text-sm px-4 py-2 text-center">
          {tokenRefreshError}
        </div>
      )}
      {/* Stream info bar */}
      <div className="flex-shrink-0 bg-white/60 backdrop-blur-md border-b border-casual-pink/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/logos/icon.jpg" 
            alt="Channel Avatar" 
            className="h-12 w-12 rounded-full object-cover ring-2 ring-casual-pink cursor-pointer hover:ring-casual-violet transition-all"
            onClick={spawnEasterEmojis}
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-casual-dark">{streamData.title}</h2>
            <p className="text-sm text-casual-dark/70">Da Movies - Movie Marathon</p>
          </div>
          <h2 className="text-lg md:text-xl text-casual-dark font-bold hidden md:block">
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
            {/* Clip show link */}
            <div className="bg-white/40 backdrop-blur-sm border-t border-casual-violet/30 px-4 py-5 sm:py-6">
              <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 max-w-3xl mx-auto">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 shrink-0 text-casual-pink drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                <a
                  href="https://www.youtube.com/playlist?list=PLsTN7jx6BmIkqKbcU_HeUo3YRbEn9OGZh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex-1 min-w-0 rounded-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                >
                  <div className="bg-gradient-to-r from-casual-yellow via-casual-pink to-casual-violet rounded-2xl px-6 sm:px-10 py-4 sm:py-5 text-center shadow-lg hover:shadow-xl transition-shadow duration-300 border-2 border-white/60">
                    <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-casual-dark tracking-tight">
                      Click here for the clip show
                    </div>
                  </div>
                </a>

                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 shrink-0 text-casual-pink drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M19 12H5M11 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Polls Section */}
            <div className="bg-white/30 backdrop-blur-sm border-t-2 border-casual-violet/30 px-4 py-4">
              {/* Polls Header */}
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-casual-dark inline-block">
                  Polls
                </h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-casual-pink to-transparent"></div>
                  <span className="text-xs uppercase tracking-wider text-casual-dark/70 font-semibold">
                    Vote & See Results
                  </span>
                  <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-casual-pink to-transparent"></div>
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

