'use client';

import { useEffect, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import type MuxPlayerElement from '@mux/mux-player';
import { supabase } from '@/lib/supabase';
import { useRealtimeHealth, type RealtimeHealthStatus } from '@/hooks/useRealtimeHealth';
import {
  CHANNEL_NAMES,
  PLAYBACK_ACTIONS,
  DATABASE_TABLES,
  SYNC_THRESHOLDS,
} from '@/lib/constants';

interface VideoPlayerProps {
  playbackId: string;
  token: string;
  title: string;
  isAdmin?: boolean; // Allow admin to control playback manually
  isHoldScreen?: boolean; // Loop playback for hold screens
}

export default function VideoPlayer({ playbackId, token, title, isAdmin = false, isHoldScreen = false }: VideoPlayerProps) {
  const playerRef = useRef<MuxPlayerElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  
  // Realtime connection health monitoring
  const realtimeHealth = useRealtimeHealth();
  
  // Track when we last received a realtime update
  const lastRealtimeUpdateRef = useRef<number>(Date.now());
  
  // Track last update timestamp to prevent echoing admin's own actions
  const lastLocalUpdateRef = useRef<number>(0);
  
  // Track pending actions with unique IDs for better echo prevention
  const pendingActionsRef = useRef<Map<string, number>>(new Map());
  
  // Debounce admin control updates to prevent rapid-fire syncs
  const adminUpdateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Circuit breaker for sync failures
  const syncErrorCountRef = useRef<number>(0);
  const lastSyncErrorRef = useRef<number>(0);
  
  // SYNC FIX: Track last synced state to prevent redundant syncs
  const lastSyncedStateRef = useRef<{
    playbackId: string;
    state: string;
    position: number;
    updatedAt: string;
  } | null>(null);
  
  // SYNC FIX: Debounce realtime sync events to prevent rapid-fire updates
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
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

      // Don't auto-advance when hold screen is active (it should loop indefinitely)
      if (isHoldScreen) {
        console.log('Hold screen is active, skipping auto-advance');
        return;
      }

      // Prevent concurrent auto-advance operations
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
      }
    };

    player.addEventListener('ended', handleVideoEnded);

    return () => {
      player.removeEventListener('ended', handleVideoEnded);
    };
  }, [isAdmin, autoAdvanceEnabled, isHoldScreen]);

  // Reset auto-advance lock when playbackId changes (new video started)
  useEffect(() => {
    autoAdvanceInProgressRef.current = false;
  }, [playbackId]);

  // Development mode check
  useEffect(() => {
    if (playbackId === 'demo-playback-id') {
      console.log('⚠️  Development mode: Mock video player (configure Mux for real playback)');
      setError('Configure Mux credentials in .env.local to enable video playback');
    }
  }, [playbackId]);

  // Synchronized playback effect - subscribe to admin's playback control
  useEffect(() => {
    // Admins don't need to sync - they ARE the source of truth
    if (isAdmin || !playerRef.current) return;

    const video = playerRef.current;

    // Function to sync video state
    const syncPlaybackState = async (
      state: string,
      position: number | string,
      updatedAt: string,
      elapsedMs: number | string = 0
    ) => {
      if (!video || isSyncing) return;
      
      const updateTimestamp = new Date(updatedAt).getTime();
      const numericPosition = typeof position === 'string' ? parseFloat(position) : position;
      const numericElapsedMs = typeof elapsedMs === 'string' ? parseFloat(elapsedMs) : elapsedMs;

      if (Number.isNaN(numericPosition)) {
        console.warn('Skipping sync due to invalid playback position:', position);
        return;
      }
      
      // SYNC FIX: Check if this is a duplicate sync event
      const lastSynced = lastSyncedStateRef.current;
      if (lastSynced && 
          lastSynced.playbackId === playbackId &&
          lastSynced.state === state && 
          Math.abs(lastSynced.position - numericPosition) < 0.5 &&
          lastSynced.updatedAt === updatedAt) {
        console.log('📍 Skipping duplicate sync event');
        return;
      }
      
      // SYNC FIX: Debounce rapid sync events (except for state changes)
      const stateChanged = lastSynced && lastSynced.state !== state;
      const videoChanged = lastSynced && lastSynced.playbackId !== playbackId;
      
      if (!stateChanged && !videoChanged && syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      
      const performSync = async () => {
        setIsSyncing(true);

        try {
          // CLOCK SKEW FIX: Use server-side elapsed time if available
          const latencySeconds = SYNC_THRESHOLDS.LATENCY_ESTIMATE_MS / 1000;
          let targetPosition = numericPosition;
          if (state === 'playing') {
            if (!Number.isNaN(numericElapsedMs) && numericElapsedMs > 0) {
              // Use server-calculated elapsed time (no clock skew)
              targetPosition = numericPosition + (numericElapsedMs / 1000) + latencySeconds;
            } else {
              // Fallback to client-side calculation
              const now = Date.now();
              const elapsed = (now - updateTimestamp) / 1000;
              targetPosition = numericPosition + elapsed + latencySeconds;
            }
          }

          // Sync position to keep everyone in sync
          const currentTime = video.currentTime;
          const timeDiff = Math.abs(currentTime - targetPosition);
          
          // SYNC FIX: Use more lenient thresholds to prevent unnecessary seeks
          // Only seek if significantly out of sync to avoid "restart" feeling
          const syncThreshold = state === 'playing' ? SYNC_THRESHOLDS.SYNC_THRESHOLD_PLAYING : SYNC_THRESHOLDS.SYNC_THRESHOLD_PAUSED;
          
          if (timeDiff > syncThreshold) {
            console.log(`🔄 Syncing: seeking to ${targetPosition.toFixed(1)}s (off by ${timeDiff.toFixed(1)}s)`);
            video.currentTime = targetPosition;
          } else if (timeDiff > SYNC_THRESHOLDS.MINOR_DRIFT_THRESHOLD) {
            console.log(`📍 Minor drift detected (${timeDiff.toFixed(1)}s) but within tolerance`);
          }

          // Sync play/pause state
          if (state === 'playing' && video.paused) {
            try {
              console.log('▶️ Playing video');
              await video.play();
            } catch (err) {
              console.error('Failed to play video:', err);
            }
          } else if (state === 'paused' && !video.paused) {
            console.log('⏸️ Pausing video');
            video.pause();
          }
          
          // Update last synced state to prevent duplicate syncs
          lastSyncedStateRef.current = {
            playbackId,
            state,
            position: numericPosition,
            updatedAt,
          };
          
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
      
      // SYNC FIX: For state changes or video changes, sync immediately
      // For position updates, debounce to prevent rapid-fire syncs
      if (stateChanged || videoChanged) {
        console.log(`🎬 Immediate sync: ${stateChanged ? 'state change' : 'video change'}`);
        await performSync();
      } else {
        // Debounce position-only updates
        syncDebounceRef.current = setTimeout(performSync, 200);
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
      .channel(CHANNEL_NAMES.PLAYBACK_SYNC)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: DATABASE_TABLES.CURRENT_STREAM,
          filter: 'id=eq.1',
        },
        (payload) => {
          // Track that we received a realtime update
          lastRealtimeUpdateRef.current = Date.now();
          
          const newState = payload.new as any;
          const oldState = payload.old as any;
          
          // SYNC FIX: Enhanced logging to track what changed
          const changes: string[] = [];
          if (newState.playback_state !== oldState.playback_state) {
            changes.push(`state: ${oldState.playback_state} → ${newState.playback_state}`);
          }
          if (Math.abs(newState.playback_position - oldState.playback_position) > 0.1) {
            changes.push(`position: ${oldState.playback_position.toFixed(1)}s → ${newState.playback_position.toFixed(1)}s`);
          }
          if (newState.playback_id !== oldState.playback_id) {
            changes.push(`video changed`);
          }
          
          if (changes.length > 0) {
            console.log(`📡 Realtime update (${newState.last_playback_command || 'unknown'}):`, changes.join(', '));
          } else {
            console.log('📡 Realtime update received but no playback changes detected');
          }
          
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
        if (status === 'SUBSCRIBED') {
          lastRealtimeUpdateRef.current = Date.now();
        }
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
    };
  }, [playbackId, isSyncing, realtimeHealth, isAdmin]);

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
              const latencySeconds = SYNC_THRESHOLDS.LATENCY_ESTIMATE_MS / 1000;
              
              let targetPosition = data.playback_position;
              if (data.playback_state === 'playing') {
                targetPosition = data.playback_position + elapsed + latencySeconds;
              }
              
              const timeDiff = Math.abs(video.currentTime - targetPosition);
              if (timeDiff > SYNC_THRESHOLDS.MINOR_DRIFT_THRESHOLD) {
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
            action: PLAYBACK_ACTIONS.SEEK,
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
          action: PLAYBACK_ACTIONS.PLAY,
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
          action: PLAYBACK_ACTIONS.PAUSE,
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
      <div className="aspect-video bg-white/30 flex items-center justify-center rounded-xl">
        <div className="text-center p-6 twitch-card">
          <p className="text-red-500 mb-4">{error}</p>
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
    <div className="relative aspect-video bg-black overflow-hidden max-h-screen rounded-lg">
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
        accentColor="#fbcfe8"
        className="w-full h-full"
        onPlay={isAdmin ? handlePlay : undefined}
        onPause={isAdmin ? handlePause : undefined}
        onSeeked={isAdmin ? handleSeek : undefined}
        loop={isHoldScreen}
        autoPlay={isHoldScreen}
        // Only disable controls for viewers if you want admin-only control
        // Leave commented to allow viewers to control their own playback
        // disabled={!isAdmin}
      />
      
      {/* Realtime Health Indicator */}
      {realtimeHealth !== 'healthy' && (
        <div className={`absolute top-4 right-4 text-casual-dark text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10 backdrop-blur-sm ${
          realtimeHealth === 'degraded' ? 'bg-casual-yellow/90' : 'bg-casual-pink/90'
        }`}>
          {realtimeHealth === 'degraded' ? 'Connection Degraded' : 'Connection Lost'}
        </div>
      )}
      
      {/* Admin Mode Indicator */}
      {isAdmin && autoAdvanceEnabled && !isHoldScreen && (
        <div className="absolute top-4 left-4 bg-casual-mint/90 backdrop-blur-sm text-casual-dark text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10">
          <span>Auto-Advance On</span>
        </div>
      )}
      
      {/* Hold Screen Indicator */}
      {isHoldScreen && (
        <div className="absolute top-4 left-4 bg-casual-violet/90 backdrop-blur-sm text-casual-dark text-xs px-3 py-1 rounded-full font-bold flex items-center gap-2 z-10">
          <span>Hold Screen</span>
        </div>
      )}
    </div>
  );
}

