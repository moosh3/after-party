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
  useTokenRefresh(streamData, setStreamData);

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

  // Show poster mode if enabled
  if (showPoster && !isRegistered) {
    return (
      <div 
        className="min-h-screen bg-twitch-darker flex flex-col items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/assets/backgrounds/background_.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto'
        }}
      >
        <div className="absolute inset-0 bg-black/60 w-full h-full"></div>
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
          {/* Event Poster */}
          <div className="flex justify-center animate-fade-in flex-shrink-0">
            <img 
              src="/assets/images/event-poster.png" 
              alt="After Party Movie Marathon" 
              className="w-full max-w-xs md:max-w-md h-auto rounded-lg shadow-2xl"
              style={{
                boxShadow: '0 0 50px rgba(220, 38, 38, 0.5), 0 0 100px rgba(8, 145, 178, 0.3)',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          </div>
          
          {/* Countdown Timer */}
          <div className="w-full md:flex-1">
            <EventCountdown />
          </div>
        </div>
      </div>
    );
  }

  // Show registration form if poster is disabled
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
    <div className="h-screen bg-twitch-darker text-twitch-text flex flex-col overflow-hidden">
      {/* Stream info bar */}
      <div className="flex-shrink-0 bg-twitch-dark border-b border-twitch-border px-4 py-3">
        <div className="flex items-center gap-3">
          <img 
            src="/assets/logos/alecmklogo.png" 
            alt="Channel Avatar" 
            className="h-12 w-12 rounded-full object-cover"
          />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{streamData.title}</h2>
            <p className="text-sm text-twitch-text-alt">After Party Movie Marathon</p>
          </div>
          <h2 
            className="text-xl md:text-2xl text-red-600 hidden md:block"
            style={{ 
              fontFamily: 'Scary, serif',
              textShadow: '0 0 20px rgba(220, 38, 38, 0.6), 0 0 40px rgba(220, 38, 38, 0.4)',
              letterSpacing: '0.05em'
            }}
          >
            WELCOME TO THE AFTER PARTY MOVIE MARATHON
          </h2>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Video Player Section - Takes most of the width */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden min-h-0">
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
            {/* Welcome Message & Links */}
            <div className="bg-gradient-to-b from-twitch-dark to-twitch-gray border-t border-twitch-border px-4 py-3">
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
                      SCHEDULE
                    </div>
                  </div>
                </a>
                
                <a 
                  href="https://ableensemble.com/support/donate/" 
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
                      ABLE DONATE
                    </div>
                  </div>
                </a>
                
                <a 
                  href="https://alecandmk.wedding/registry" 
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
                      REGISTRY + RAFFLE
                    </div>
                  </div>
                </a>
                
                <a 
                  href="https://photos.app.goo.gl/DfEdTvAxxvLwrXdF8" 
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
                      ADD YOUR PHOTOS
                    </div>
                  </div>
                </a>
              </div>
            </div>

            {/* Polls Section */}
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
                  🗳️ POLLS 🗳️
                </h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="h-1 w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent animate-pulse"></div>
                  <span className="text-xs uppercase tracking-wider text-twitch-text-alt font-bold">
                    Vote & See Results
                  </span>
                  <div className="h-1 w-16 bg-gradient-to-r from-transparent via-red-600 to-transparent animate-pulse"></div>
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

