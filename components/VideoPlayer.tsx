'use client';

import { useEffect, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import type MuxPlayerElement from '@mux/mux-player';
import { supabase } from '@/lib/supabase';
import { useRealtimeHealth, type RealtimeHealthStatus } from '@/hooks/useRealtimeHealth';

interface VideoPlayerProps {
  playbackId: string;
  token: string;
  title: string;
  isAdmin?: boolean; // Allow admin to control playback manually
}

export default function VideoPlayer({ playbackId, token, title, isAdmin = false }: VideoPlayerProps) {
  const playerRef = useRef<MuxPlayerElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  
  // Realtime connection health monitoring
  const realtimeHealth = useRealtimeHealth();
  
  // Track last update timestamp to prevent echoing admin's own actions
  const lastLocalUpdateRef = useRef<number>(0);
  
  // Track pending actions with unique IDs for better echo prevention
  const pendingActionsRef = useRef<Map<string, number>>(new Map());
  
  // Debounce admin control updates to prevent rapid-fire syncs
  const adminUpdateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Circuit breaker for sync failures
  const syncErrorCountRef = useRef<number>(0);
  const lastSyncErrorRef = useRef<number>(0);
  
  // ISSUE #2: Track if auto-advance is in progress to prevent race conditions
  const autoAdvanceInProgressRef = useRef<boolean>(false);

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

      // ISSUE #2: Prevent concurrent auto-advance operations
      if (autoAdvanceInProgressRef.current) {
        console.log('Auto-advance already in progress, skipping...');
        return;
      }

      autoAdvanceInProgressRef.current = true;

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
      } finally {
        // Reset lock after a delay to prevent rapid re-triggers
        setTimeout(() => {
          autoAdvanceInProgressRef.current = false;
        }, 2000);
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
      updatedAt: string,
      elapsedMs: number = 0
    ) => {
      if (!video || isSyncing) return;
      
      const updateTimestamp = new Date(updatedAt).getTime();
      
      // ISSUE #5: Protect against stale updates
      // If this update is older than our last local update (for admins), ignore it
      if (isAdmin && updateTimestamp <= lastLocalUpdateRef.current) {
        console.log('Ignoring stale update (older than last local action)');
        return;
      }
      
      // IMPROVED: Check if this is an echo of our own action
      if (isAdmin) {
        const matchingAction = Array.from(pendingActionsRef.current.entries())
          .find(([id, ts]) => {
            const [actionType] = id.split('-');
            return actionType === state && Math.abs(updateTimestamp - ts) < 2000;
          });
        
        if (matchingAction) {
          console.log('Ignoring echo of local admin action:', matchingAction[0]);
          pendingActionsRef.current.delete(matchingAction[0]);
          return;
        }
      }
      
      // Cleanup old pending actions (older than 5 seconds)
      for (const [id, ts] of pendingActionsRef.current.entries()) {
        if (Date.now() - ts > 5000) {
          pendingActionsRef.current.delete(id);
        }
      }
      
      setIsSyncing(true);

      try {
        // CLOCK SKEW FIX: Use server-side elapsed time if available
        let targetPosition = position;
        if (state === 'playing') {
          if (elapsedMs > 0) {
            // Use server-calculated elapsed time (no clock skew)
            targetPosition = position + (elapsedMs / 1000) + 0.15; // Add latency estimate
          } else {
            // Fallback to client-side calculation
            const now = Date.now();
            const elapsed = (now - updateTimestamp) / 1000;
            targetPosition = position + elapsed + 0.15;
          }
        }

        // For non-admin users, sync position to keep everyone in sync
        // For admin users, skip position sync to allow manual control
        if (!isAdmin) {
          const currentTime = video.currentTime;
          const timeDiff = Math.abs(currentTime - targetPosition);
          
          // Use adaptive threshold based on whether video is playing
          const syncThreshold = state === 'playing' ? 3 : 1;
          
          if (timeDiff > syncThreshold) {
            console.log(`Syncing: seeking to ${targetPosition.toFixed(1)}s (off by ${timeDiff.toFixed(1)}s)`);
            video.currentTime = targetPosition;
          }
        }

        // Sync play/pause state for both admin and viewers
        if (state === 'playing' && video.paused) {
          try {
            await video.play();
          } catch (err) {
            console.error('Failed to play video:', err);
          }
        } else if (state === 'paused' && !video.paused) {
          video.pause();
        }
        
        // CIRCUIT BREAKER: Reset error count on success
        syncErrorCountRef.current = 0;
      } catch (err) {
        console.error('Error syncing playback:', err);
        
        // CIRCUIT BREAKER: Track sync failures
        syncErrorCountRef.current++;
        lastSyncErrorRef.current = Date.now();
        
        if (syncErrorCountRef.current >= 5) {
          console.error('⚠️ Too many sync failures, entering degraded mode');
          setError('Connection issues detected. Playback may be out of sync. Try refreshing.');
        }
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
            data.playback_updated_at,
            data.playback_elapsed_ms || 0
          );
        }
      } catch (err) {
        console.error('Failed to load playback state:', err);
        
        // CIRCUIT BREAKER: Track polling failures too
        syncErrorCountRef.current++;
        if (syncErrorCountRef.current >= 5) {
          setError('Unable to connect to playback server. Try refreshing.');
        }
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
              newState.playback_updated_at,
              newState.playback_elapsed_ms || 0
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('Playback sync subscription status:', status);
      });

    // Dynamic polling based on realtime health
    // If realtime is healthy, poll less frequently (30s)
    // If degraded/offline, poll more frequently (5s)
    const syncInterval = setInterval(() => {
      loadPlaybackState();
    }, realtimeHealth === 'healthy' ? 30000 : 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
      if (adminUpdateDebounceRef.current) {
        clearTimeout(adminUpdateDebounceRef.current);
      }
    };
  }, [playbackId, isAdmin, isSyncing, realtimeHealth]);

  // ISSUE #6: Handle page visibility to prevent drift when tab is backgrounded
  useEffect(() => {
    if (isAdmin) return; // Admin doesn't need this
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isSyncing) {
        // Tab became visible - force a sync to catch up
        console.log('Tab became visible, forcing sync...');
        try {
          const response = await fetch('/api/admin/playback-control');
          if (response.ok) {
            const data = await response.json();
            const video = playerRef.current;
            if (video) {
              const updateTimestamp = new Date(data.playback_updated_at).getTime();
              const now = Date.now();
              const elapsed = (now - updateTimestamp) / 1000;
              
              let targetPosition = data.playback_position;
              if (data.playback_state === 'playing') {
                targetPosition = data.playback_position + elapsed + 0.15;
              }
              
              const timeDiff = Math.abs(video.currentTime - targetPosition);
              if (timeDiff > 1) {
                console.log(`Correcting drift after tab visibility: ${timeDiff.toFixed(1)}s`);
                video.currentTime = targetPosition;
              }
              
              // Sync play/pause state
              if (data.playback_state === 'playing' && video.paused) {
                await video.play();
              } else if (data.playback_state === 'paused' && !video.paused) {
                video.pause();
              }
            }
          }
        } catch (err) {
          console.error('Failed to sync on visibility change:', err);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin, isSyncing]);

  // Handle seeking - sync to all viewers if admin
  const handleSeek = async () => {
    if (!playerRef.current || !isAdmin) return;
    
    // IMPROVED: Track pending action with unique ID
    const actionId = `seek-${Date.now()}`;
    const actionTimestamp = Date.now();
    pendingActionsRef.current.set(actionId, actionTimestamp);
    lastLocalUpdateRef.current = actionTimestamp;
    
    // Debounce seek events (user might be scrubbing)
    if (adminUpdateDebounceRef.current) {
      clearTimeout(adminUpdateDebounceRef.current);
    }
    
    adminUpdateDebounceRef.current = setTimeout(async () => {
      try {
        await fetch('/api/admin/playback-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'seek',
            position: playerRef.current?.currentTime || 0
          }),
        });
      } catch (err) {
        console.error('Failed to sync seek:', err);
        pendingActionsRef.current.delete(actionId);
      }
    }, 500); // Wait 500ms after last seek before syncing
  };

  const handlePlay = async () => {
    if (!isAdmin || !playerRef.current) return;
    
    // IMPROVED: Track pending action with unique ID
    const actionId = `playing-${Date.now()}`;
    const actionTimestamp = Date.now();
    pendingActionsRef.current.set(actionId, actionTimestamp);
    lastLocalUpdateRef.current = actionTimestamp;
    
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
      pendingActionsRef.current.delete(actionId);
    }
  };

  const handlePause = async () => {
    if (!isAdmin || !playerRef.current) return;
    
    // IMPROVED: Track pending action with unique ID
    const actionId = `paused-${Date.now()}`;
    const actionTimestamp = Date.now();
    pendingActionsRef.current.set(actionId, actionTimestamp);
    lastLocalUpdateRef.current = actionTimestamp;
    
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
      pendingActionsRef.current.delete(actionId);
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
        tokens={{ playback: (token !== 'placeholder-token' && token !== 'unsigned') ? token : undefined }}
        streamType="live"
        metadata={{
          video_title: title,
        }}
        defaultShowRemainingTime
        defaultHiddenCaptions={false}
        accentColor="#9147FF"
        className="w-full h-full"
        onPlay={isAdmin ? handlePlay : undefined}
        onPause={isAdmin ? handlePause : undefined}
        onSeeked={isAdmin ? handleSeek : undefined}
        // Only disable controls for viewers if you want admin-only control
        // Leave commented to allow viewers to control their own playback
        // disabled={!isAdmin}
      />
      
      {/* Realtime Health Indicator */}
      {realtimeHealth !== 'healthy' && (
        <div className={`absolute top-4 right-4 text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10 ${
          realtimeHealth === 'degraded' ? 'bg-yellow-600/90' : 'bg-red-600/90'
        }`}>
          {realtimeHealth === 'degraded' ? '⚠️ Connection Degraded' : '❌ Connection Lost'}
        </div>
      )}
      
      {/* Sync Mode Indicator for Viewers */}
      {!isAdmin && realtimeHealth === 'healthy' && (
        <div className="absolute top-4 left-4 bg-green-600/90 text-white text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>Synced</span>
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

