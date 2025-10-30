'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { supabase } from '@/lib/supabase';

interface VideoPlayerProps {
  playbackId: string;
  token: string;
  title: string;
  isAdmin?: boolean; // Allow admin to control playback manually
}

export default function VideoPlayer({ playbackId, token, title, isAdmin = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    
    // Development mode: Skip video loading if using mock data
    if (playbackId === 'demo-playback-id') {
      console.log('⚠️  Development mode: Mock video player (configure Mux for real playback)');
      setIsLoading(false);
      setError('Configure Mux credentials in .env.local to enable video playback');
      return;
    }
    
    // Construct playback URL with subtitles parameter
    const baseUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    const params = new URLSearchParams();
    
    if (token !== 'placeholder-token') {
      params.append('token', token);
    }
    params.append('default_subtitles_lang', 'en');
    
    const playbackUrl = `${baseUrl}?${params.toString()}`;

    // Initialize HLS.js
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hlsRef.current = hls;

      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        console.log('HLS manifest loaded');
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error. Retrying...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error. Attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal error occurred. Please refresh the page.');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
      });
    } else {
      setError('Your browser does not support HLS playback');
    }
  }, [playbackId, token]);

  // Synchronized playback effect - subscribe to admin's playback control
  useEffect(() => {
    if (!videoRef.current || isAdmin) return; // Admins control manually

    const video = videoRef.current;

    // Function to sync video state
    const syncPlaybackState = async (
      state: string,
      position: number,
      updatedAt: string
    ) => {
      if (!video || isSyncing) return;
      
      setIsSyncing(true);

      try {
        // Calculate actual position based on when the state was updated
        const updatedTime = new Date(updatedAt).getTime();
        const now = Date.now();
        const elapsed = (now - updatedTime) / 1000; // seconds since update
        
        let targetPosition = position;
        if (state === 'playing') {
          targetPosition = position + elapsed;
        }

        // Seek if we're more than 3 seconds off
        const currentTime = video.currentTime;
        const timeDiff = Math.abs(currentTime - targetPosition);
        
        if (timeDiff > 3) {
          console.log(`Syncing: seeking to ${targetPosition.toFixed(1)}s (off by ${timeDiff.toFixed(1)}s)`);
          video.currentTime = targetPosition;
        }

        // Sync play/pause state
        if (state === 'playing' && video.paused) {
          await video.play();
          setIsPlaying(true);
        } else if (state === 'paused' && !video.paused) {
          video.pause();
          setIsPlaying(false);
        }
      } catch (err) {
        console.error('Error syncing playback:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Load initial playback state
    async function loadPlaybackState() {
      try {
        const response = await fetch('/api/admin/playback-control');
        if (response.ok) {
          const data = await response.json();
          await syncPlaybackState(
            data.playback_state,
            data.playback_position,
            data.playback_updated_at
          );
        }
      } catch (err) {
        console.error('Failed to load playback state:', err);
      }
    }

    loadPlaybackState();

    // Subscribe to playback state changes via Supabase realtime
    const channel = supabase
      .channel('playback-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'current_stream',
          filter: 'id=eq.1',
        },
        (payload) => {
          const newState = payload.new as any;
          if (newState.playback_state && newState.playback_position !== undefined) {
            syncPlaybackState(
              newState.playback_state,
              newState.playback_position,
              newState.playback_updated_at
            );
          }
        }
      )
      .subscribe();

    // Periodic sync check every 10 seconds to handle drift
    const syncInterval = setInterval(() => {
      loadPlaybackState();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [playbackId, isAdmin, isSyncing]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  if (error) {
    return (
      <div className="aspect-video bg-twitch-darker flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="twitch-button"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group aspect-video bg-black overflow-hidden max-h-screen">
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        onClick={togglePlay}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-twitch-darker">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-twitch-purple mx-auto mb-4"></div>
            <p className="text-twitch-text-alt">Loading video...</p>
          </div>
        </div>
      )}

      {/* Custom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Sync Mode Indicator for Viewers */}
        {!isAdmin && (
          <div className="absolute -top-8 left-4 bg-twitch-purple/90 text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Watching Together - Synced</span>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {/* Play/Pause - Disabled for viewers */}
          <button
            onClick={togglePlay}
            disabled={!isAdmin}
            className={`text-white transition-colors p-1 ${
              isAdmin 
                ? 'hover:text-twitch-purple cursor-pointer' 
                : 'opacity-50 cursor-not-allowed'
            }`}
            title={isAdmin ? 'Play/Pause' : 'Playback controlled by host'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-white hover:text-twitch-purple transition-colors p-1">
              {isMuted || volume === 0 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quality Badge */}
          <div className="text-xs text-white bg-twitch-hover px-2 py-1 rounded font-medium">
            {currentQuality}
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-twitch-purple transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title Overlay - Hidden like Twitch, shown on hover */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
    </div>
  );
}

