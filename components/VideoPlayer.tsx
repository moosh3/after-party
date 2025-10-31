'use client';

import { useEffect, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { supabase } from '@/lib/supabase';

interface VideoPlayerProps {
  playbackId: string;
  token: string;
  title: string;
  isAdmin?: boolean; // Allow admin to control playback manually
}

export default function VideoPlayer({ playbackId, token, title, isAdmin = false }: VideoPlayerProps) {
  const playerRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);

  // Load auto-advance status for admin
  useEffect(() => {
    if (!isAdmin) return;

    async function loadAutoAdvanceStatus() {
      try {
        const response = await fetch('/api/admin/queue/auto-advance');
        if (response.ok) {
          const data = await response.json();
          setAutoAdvanceEnabled(data.auto_advance_enabled || false);
        }
      } catch (err) {
        console.error('Failed to load auto-advance status:', err);
      }
    }

    loadAutoAdvanceStatus();

    // Poll for status updates every 5 seconds
    const interval = setInterval(loadAutoAdvanceStatus, 5000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Handle video ended - auto-advance to next in queue
  useEffect(() => {
    if (!playerRef.current || !isAdmin) return;

    const player = playerRef.current;

    const handleVideoEnded = async () => {
      console.log('Video ended, auto-advance enabled:', autoAdvanceEnabled);

      if (!autoAdvanceEnabled) {
        console.log('Auto-advance is disabled');
        return;
      }

      try {
        const response = await fetch('/api/admin/queue/next', {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Advanced to next video:', data.advanced_to.title);
        } else {
          const data = await response.json();
          if (data.empty) {
            console.log('No more videos in queue');
          } else {
            console.error('Failed to advance to next video:', data.error);
          }
        }
      } catch (err) {
        console.error('Error advancing to next video:', err);
      }
    };

    player.addEventListener('ended', handleVideoEnded);

    return () => {
      player.removeEventListener('ended', handleVideoEnded);
    };
  }, [isAdmin, autoAdvanceEnabled]);

  // Development mode check
  useEffect(() => {
    if (playbackId === 'demo-playback-id') {
      console.log('⚠️  Development mode: Mock video player (configure Mux for real playback)');
      setError('Configure Mux credentials in .env.local to enable video playback');
    }
  }, [playbackId]);

  // Synchronized playback effect - subscribe to admin's playback control
  useEffect(() => {
    if (!playerRef.current) return;

    const video = playerRef.current;

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

        // For non-admin users, sync position to keep everyone in sync
        // For admin users, skip position sync to allow manual control
        if (!isAdmin) {
          const currentTime = video.currentTime;
          const timeDiff = Math.abs(currentTime - targetPosition);
          
          if (timeDiff > 3) {
            console.log(`Syncing: seeking to ${targetPosition.toFixed(1)}s (off by ${timeDiff.toFixed(1)}s)`);
            video.currentTime = targetPosition;
          }
        }

        // Sync play/pause state for both admin and viewers
        if (state === 'playing' && video.paused) {
          try {
            await video.play();
            setIsPlaying(true);
          } catch (err) {
            console.error('Failed to play video:', err);
          }
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

  // Handle seeking - sync to all viewers if admin
  const handleSeek = async () => {
    if (!playerRef.current || !isAdmin) return;
    
    try {
      await fetch('/api/admin/playback-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'seek',
          position: playerRef.current.currentTime 
        }),
      });
    } catch (err) {
      console.error('Failed to sync seek:', err);
    }
  };

  const handlePlay = async () => {
    if (!isAdmin || !playerRef.current) return;
    
    try {
      await fetch('/api/admin/playback-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'play',
          position: playerRef.current.currentTime 
        }),
      });
    } catch (err) {
      console.error('Failed to sync play:', err);
    }
  };

  const handlePause = async () => {
    if (!isAdmin || !playerRef.current) return;
    
    try {
      await fetch('/api/admin/playback-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'pause',
          position: playerRef.current.currentTime 
        }),
      });
    } catch (err) {
      console.error('Failed to sync pause:', err);
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
    <div className="relative aspect-video bg-black overflow-hidden max-h-screen">
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        tokens={{ playback: token !== 'placeholder-token' ? token : undefined }}
        streamType="on-demand"
        metadata={{
          video_title: title,
        }}
        defaultShowRemainingTime
        accentColor="#9147FF"
        className="w-full h-full"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeek}
      />
      
      {/* Sync Mode Indicator for Viewers */}
      {!isAdmin && (
        <div className="absolute top-4 left-4 bg-twitch-purple/90 text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>Watching Together - Synced</span>
        </div>
      )}
      
      {/* Admin Mode Indicator */}
      {isAdmin && autoAdvanceEnabled && (
        <div className="absolute top-4 left-4 bg-success/90 text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10">
          <span>▶</span>
          <span>Auto-Advance Enabled</span>
        </div>
      )}
    </div>
  );
}

