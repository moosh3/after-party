'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import type MuxPlayerElement from '@mux/mux-player';
import { supabase } from '@/lib/supabase';
import { useRealtimeHealth } from '@/hooks/useRealtimeHealth';
import {
  CHANNEL_NAMES,
  PLAYBACK_ACTIONS,
  DATABASE_TABLES,
  SYNC_THRESHOLDS,
} from '@/lib/constants';
import {
  MUX_SOURCE_TYPE,
  YOUTUBE_PLAYLIST_SOURCE_TYPE,
  parseYouTubePlaylistPlaybackId,
  type MediaSourceType,
} from '@/lib/youtube';

interface VideoPlayerProps {
  playbackId: string;
  token: string;
  title: string;
  kind?: string;
  isAdmin?: boolean;
  allowAdminBroadcast?: boolean;
  isHoldScreen?: boolean;
  playoutMode?: 'manual' | 'schedule' | string;
  playbackState?: 'playing' | 'paused' | string;
  playbackPosition?: number;
  playbackUpdatedAt?: string;
  playbackElapsedMs?: number;
  activeSlotId?: string | null;
  sourceType?: MediaSourceType | string;
  youtubePlaylistId?: string | null;
  sourceUrl?: string | null;
}

type PlaybackStateResponse = {
  playback_state?: string;
  playback_position?: number | string;
  playback_updated_at?: string;
  playback_elapsed_ms?: number | string;
};

type YouTubePlayerEvent = {
  target: YouTubePlayer;
  data?: number;
};

type YouTubePlayer = {
  destroy: () => void;
  loadPlaylist: (options: {
    listType: 'playlist';
    list: string;
    index?: number;
    startSeconds?: number;
  }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  setLoop?: (loopPlaylists: boolean) => void;
  getPlaylist?: () => string[];
  getPlaylistIndex?: () => number;
  playVideoAt?: (index: number) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
    __youtubeIframeApiReady?: Promise<YouTubeApi>;
  }
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (!window.__youtubeIframeApiReady) {
    window.__youtubeIframeApiReady = new Promise((resolve) => {
      const previousCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve(window.YT as YouTubeApi);
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }

  return window.__youtubeIframeApiReady as Promise<YouTubeApi>;
}

function YouTubePlaylistPlayer({
  playlistId,
  title,
  viewerLocked,
}: {
  playlistId: string;
  title: string;
  viewerLocked: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const volumeRef = useRef(80);
  const mutedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let disposed = false;

    setIsReady(false);
    setLoadError(false);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (disposed || !mountRef.current) return;

        const player = new YT.Player(mountRef.current, {
          width: '100%',
          height: '100%',
          playerVars: {
            listType: 'playlist',
            list: playlistId,
            loop: 1,
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            enablejsapi: 1,
            cc_load_policy: 1,
            cc_lang_pref: 'en',
            iv_load_policy: 3,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;

              playerRef.current = event.target;
              event.target.setLoop?.(true);
              event.target.setVolume(volumeRef.current);
              if (mutedRef.current) {
                event.target.mute();
              } else {
                event.target.unMute();
              }
              event.target.loadPlaylist({
                listType: 'playlist',
                list: playlistId,
                index: 0,
                startSeconds: 0,
              });
              event.target.playVideo();
              setIsReady(true);
            },
            onStateChange: (event) => {
              if (!viewerLocked) return;

              if (event.data === YT.PlayerState.PAUSED) {
                window.setTimeout(() => event.target.playVideo(), 100);
              }

              if (event.data === YT.PlayerState.ENDED) {
                const playlist = event.target.getPlaylist?.() || [];
                const index = event.target.getPlaylistIndex?.() ?? 0;

                if (playlist.length > 0 && index >= playlist.length - 1) {
                  event.target.playVideoAt?.(0);
                } else {
                  event.target.playVideo();
                }
              }
            },
            onError: () => {
              if (!disposed) setLoadError(true);
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        if (!disposed) setLoadError(true);
      });

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [playlistId, viewerLocked]);

  useEffect(() => {
    volumeRef.current = volume;
    playerRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    mutedRef.current = muted;
    if (!playerRef.current) return;

    if (muted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [muted]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await containerRef.current.requestFullscreen().catch(() => undefined);
  };

  if (loadError) {
    return (
      <div className="aspect-video bg-black flex items-center justify-center rounded-lg">
        <div className="text-center p-6 twitch-card">
          <p className="text-red-500 mb-4">Unable to load YouTube playlist.</p>
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
    <div ref={containerRef} className="relative aspect-video bg-black overflow-hidden max-h-screen rounded-lg">
      <div className="absolute inset-0 h-full w-full">
        <div ref={mountRef} className="h-full w-full" title={title} />
      </div>
      {viewerLocked && <div className="absolute inset-0 z-10" aria-hidden="true" />}

      {!isReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black text-white text-sm">
          Loading playlist
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-md bg-black/75 px-3 py-2 text-white">
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="min-h-[32px] rounded bg-white/15 px-2 text-xs font-semibold hover:bg-white/25"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? 'UNMUTE' : 'MUTE'}
        </button>
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => {
            const nextVolume = Number(event.target.value);
            setVolume(nextVolume);
            if (nextVolume > 0 && muted) setMuted(false);
          }}
          className="w-24"
        />
        <button
          type="button"
          onClick={toggleFullscreen}
          className="min-h-[32px] rounded bg-white/15 px-2 text-xs font-semibold hover:bg-white/25"
          aria-label="Fullscreen"
        >
          FULL
        </button>
      </div>
    </div>
  );
}

export default function VideoPlayer({
  playbackId,
  token,
  title,
  kind = 'vod',
  isAdmin = false,
  allowAdminBroadcast = isAdmin,
  isHoldScreen = false,
  playoutMode = 'manual',
  playbackState = 'playing',
  playbackPosition = 0,
  playbackUpdatedAt,
  playbackElapsedMs = 0,
  activeSlotId = null,
  sourceType = MUX_SOURCE_TYPE,
  youtubePlaylistId = null,
}: VideoPlayerProps) {
  const playerRef = useRef<MuxPlayerElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const canBroadcastAdminControls = isAdmin && allowAdminBroadcast;
  const viewerLocked = !canBroadcastAdminControls;
  const realtimeHealth = useRealtimeHealth();

  const isSyncingRef = useRef(false);
  const lastRealtimeUpdateRef = useRef<number>(Date.now());
  const adminUpdateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const syncErrorCountRef = useRef<number>(0);
  const endedSlotRef = useRef<string | null>(null);
  const manualEndedPlaybackRef = useRef<string | null>(null);
  const lastSyncedStateRef = useRef<{
    playbackId: string;
    state: string;
    position: number;
    updatedAt: string;
  } | null>(null);

  const applyPlaybackState = useCallback(
    async (
      state: string,
      position: number | string,
      updatedAt: string,
      elapsedMs: number | string = 0
    ) => {
      const video = playerRef.current;
      if (!video || isSyncingRef.current) return;

      const numericPosition = typeof position === 'string' ? parseFloat(position) : position;
      const numericElapsedMs = typeof elapsedMs === 'string' ? parseFloat(elapsedMs) : elapsedMs;

      if (Number.isNaN(numericPosition)) {
        console.warn('Skipping sync due to invalid playback position:', position);
        return;
      }

      const lastSynced = lastSyncedStateRef.current;
      if (
        lastSynced &&
        lastSynced.playbackId === playbackId &&
        lastSynced.state === state &&
        Math.abs(lastSynced.position - numericPosition) < 0.5 &&
        lastSynced.updatedAt === updatedAt
      ) {
        return;
      }

      const performSync = async () => {
        isSyncingRef.current = true;
        setIsSyncing(true);

        try {
          const latencySeconds = SYNC_THRESHOLDS.LATENCY_ESTIMATE_MS / 1000;
          let targetPosition = numericPosition;

          if (state === 'playing') {
            if (!Number.isNaN(numericElapsedMs) && numericElapsedMs > 0) {
              targetPosition = numericPosition + numericElapsedMs / 1000 + latencySeconds;
            } else {
              const updateTimestamp = new Date(updatedAt).getTime();
              const elapsed = Number.isNaN(updateTimestamp) ? 0 : (Date.now() - updateTimestamp) / 1000;
              targetPosition = numericPosition + elapsed + latencySeconds;
            }
          }

          const timeDiff = Math.abs(video.currentTime - targetPosition);
          const syncThreshold =
            state === 'playing'
              ? SYNC_THRESHOLDS.SYNC_THRESHOLD_PLAYING
              : SYNC_THRESHOLDS.SYNC_THRESHOLD_PAUSED;

          if (timeDiff > syncThreshold) {
            video.currentTime = Math.max(0, targetPosition);
          }

          if (state === 'playing' && video.paused) {
            await video.play().catch((err) => {
              console.error('Failed to play video:', err);
            });
          } else if (state === 'paused' && !video.paused) {
            video.pause();
          }

          lastSyncedStateRef.current = {
            playbackId,
            state,
            position: numericPosition,
            updatedAt,
          };
          syncErrorCountRef.current = 0;
        } catch (err) {
          console.error('Error syncing playback:', err);
          syncErrorCountRef.current += 1;

          if (syncErrorCountRef.current >= 5) {
            setError('Connection issues detected. Playback may be out of sync. Try refreshing.');
          }
        } finally {
          isSyncingRef.current = false;
          setIsSyncing(false);
        }
      };

      const stateChanged = lastSynced && lastSynced.state !== state;
      const videoChanged = lastSynced && lastSynced.playbackId !== playbackId;

      if (stateChanged || videoChanged) {
        await performSync();
      } else {
        if (syncDebounceRef.current) {
          clearTimeout(syncDebounceRef.current);
        }
        syncDebounceRef.current = setTimeout(performSync, 200);
      }
    },
    [playbackId]
  );

  const loadAndSyncPlaybackState = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/playback-control');
      if (!response.ok) return;

      const data = (await response.json()) as PlaybackStateResponse;
      if (
        data.playback_state &&
        data.playback_position !== undefined &&
        data.playback_updated_at
      ) {
        await applyPlaybackState(
          data.playback_state,
          data.playback_position,
          data.playback_updated_at,
          data.playback_elapsed_ms || 0
        );
      }
    } catch (err) {
      console.error('Failed to load playback state:', err);
      syncErrorCountRef.current += 1;

      if (syncErrorCountRef.current >= 5) {
        setError('Unable to connect to playback server. Try refreshing.');
      }
    }
  }, [applyPlaybackState]);

  useEffect(() => {
    setError(null);
  }, [playbackId, sourceType]);

  useEffect(() => {
    if (sourceType === MUX_SOURCE_TYPE && playbackId === 'demo-playback-id') {
      console.log('Development mode: Mock video player (configure Mux for real playback)');
      setError('Configure Mux credentials in .env.local to enable video playback');
    }
  }, [playbackId, sourceType]);

  useEffect(() => {
    endedSlotRef.current = null;
    manualEndedPlaybackRef.current = null;
    lastSyncedStateRef.current = null;
  }, [playbackId, activeSlotId]);

  useEffect(() => {
    const player = playerRef.current;
    if (sourceType !== MUX_SOURCE_TYPE || !player || isHoldScreen || kind === 'live') return;

    let attempts = 0;
    let timeout: NodeJS.Timeout | null = null;

    const getCaptionTargets = () => {
      const internals = player as MuxPlayerElement & {
        media?: HTMLMediaElement | null;
        mediaController?: HTMLElement | null;
        mediaTheme?: HTMLElement | null;
      };

      return [
        player,
        internals.mediaController,
        internals.mediaTheme,
        player.shadowRoot?.querySelector('media-controller'),
        player.shadowRoot?.querySelector('media-theme'),
      ].filter((target): target is HTMLElement => target instanceof HTMLElement);
    };

    const requestCaptions = () => {
      for (const target of getCaptionTargets()) {
        target.setAttribute('defaultsubtitles', '');
        target.dispatchEvent(new CustomEvent('mediashowsubtitlesrequest', {
          bubbles: true,
          composed: true,
          detail: true,
        }));
      }

      const textTracks =
        player.textTracks ||
        (player as MuxPlayerElement & { media?: HTMLMediaElement | null }).media?.textTracks;
      const captionTrack = textTracks
        ? Array.from(textTracks).find((track) =>
            track.kind === 'subtitles' || track.kind === 'captions'
          )
        : null;

      if (captionTrack) {
        captionTrack.mode = 'showing';
      }

      attempts += 1;
      if (attempts < 6) {
        timeout = setTimeout(requestCaptions, 750);
      }
    };

    const handleReady = () => {
      attempts = 0;
      if (timeout) clearTimeout(timeout);
      requestCaptions();
    };

    player.addEventListener('loadstart', handleReady);
    player.addEventListener('loadedmetadata', handleReady);
    player.addEventListener('canplay', handleReady);
    requestCaptions();

    return () => {
      player.removeEventListener('loadstart', handleReady);
      player.removeEventListener('loadedmetadata', handleReady);
      player.removeEventListener('canplay', handleReady);
      if (timeout) clearTimeout(timeout);
    };
  }, [playbackId, isHoldScreen, kind, sourceType]);

  useEffect(() => {
    if (canBroadcastAdminControls || !playerRef.current) return;

    const updatedAt = playbackUpdatedAt || new Date().toISOString();
    applyPlaybackState(playbackState, playbackPosition, updatedAt, playbackElapsedMs);
  }, [
    canBroadcastAdminControls,
    playbackState,
    playbackPosition,
    playbackUpdatedAt,
    playbackElapsedMs,
    applyPlaybackState,
  ]);

  useEffect(() => {
    if (canBroadcastAdminControls || !playerRef.current) return;

    loadAndSyncPlaybackState();

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
          lastRealtimeUpdateRef.current = Date.now();

          const newState = payload.new as any;
          const oldState = payload.old as any;
          const playbackChanged =
            newState.playback_state !== oldState.playback_state ||
            Number(newState.playback_position || 0) !== Number(oldState.playback_position || 0) ||
            newState.playback_updated_at !== oldState.playback_updated_at ||
            newState.playback_id !== oldState.playback_id ||
            newState.playout_mode !== oldState.playout_mode ||
            newState.schedule_early_ended_slot !== oldState.schedule_early_ended_slot ||
            newState.last_command_id !== oldState.last_command_id;

          if (!playbackChanged) return;

          if (newState.playout_mode === 'schedule' || newState.schedule_early_ended_slot) {
            loadAndSyncPlaybackState();
            return;
          }

          if (newState.playback_state && newState.playback_position !== undefined) {
            applyPlaybackState(
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

    const syncInterval = setInterval(
      loadAndSyncPlaybackState,
      realtimeHealth === 'healthy' ? 30000 : 5000
    );

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, [
    canBroadcastAdminControls,
    playbackId,
    realtimeHealth,
    applyPlaybackState,
    loadAndSyncPlaybackState,
  ]);

  useEffect(() => {
    if (canBroadcastAdminControls) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isSyncingRef.current) {
        loadAndSyncPlaybackState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canBroadcastAdminControls, loadAndSyncPlaybackState]);

  const sendAdminPlaybackCommand = async (action: string, position?: number) => {
    if (!canBroadcastAdminControls) return;

    try {
      const response = await fetch('/api/admin/playback-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, position }),
      });

      if (response.status === 409) {
        const data = await response.json();
        console.warn(data.error);
      }
    } catch (err) {
      console.error(`Failed to sync ${action}:`, err);
    }
  };

  const handleSeek = async () => {
    if (!playerRef.current || !canBroadcastAdminControls) return;

    if (adminUpdateDebounceRef.current) {
      clearTimeout(adminUpdateDebounceRef.current);
    }

    adminUpdateDebounceRef.current = setTimeout(() => {
      sendAdminPlaybackCommand(PLAYBACK_ACTIONS.SEEK, playerRef.current?.currentTime || 0);
    }, 500);
  };

  const handlePlay = async () => {
    if (!playerRef.current || !canBroadcastAdminControls) return;
    await sendAdminPlaybackCommand(PLAYBACK_ACTIONS.PLAY, playerRef.current.currentTime);
  };

  const handlePause = async () => {
    if (!playerRef.current || !canBroadcastAdminControls) return;
    await sendAdminPlaybackCommand(PLAYBACK_ACTIONS.PAUSE, playerRef.current.currentTime);
  };

  const correctViewerControlAttempt = () => {
    if (canBroadcastAdminControls || isSyncingRef.current || playerRef.current?.ended) return;
    window.setTimeout(loadAndSyncPlaybackState, 100);
  };

  const handleEnded = async () => {
    if (playoutMode === 'schedule' && activeSlotId && !isHoldScreen) {
      if (endedSlotRef.current === activeSlotId) return;
      endedSlotRef.current = activeSlotId;

      try {
        await fetch('/api/playout/slot-ended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId: activeSlotId, playbackId }),
        });
      } catch (err) {
        console.error('Failed to notify scheduled slot ended:', err);
      } finally {
        await loadAndSyncPlaybackState();
      }
    } else if (playoutMode === 'manual' && !isHoldScreen) {
      if (manualEndedPlaybackRef.current === playbackId) return;
      manualEndedPlaybackRef.current = playbackId;

      try {
        await fetch('/api/playout/manual-ended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playbackId }),
        });
      } catch (err) {
        console.error('Failed to notify manual video ended:', err);
      } finally {
        await loadAndSyncPlaybackState();
      }
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

  if (sourceType === YOUTUBE_PLAYLIST_SOURCE_TYPE) {
    const playlistId = youtubePlaylistId || parseYouTubePlaylistPlaybackId(playbackId);

    if (!playlistId) {
      return (
        <div className="aspect-video bg-black flex items-center justify-center rounded-lg">
          <div className="text-center p-6 twitch-card">
            <p className="text-red-500">Invalid YouTube playlist source.</p>
          </div>
        </div>
      );
    }

    return (
      <YouTubePlaylistPlayer
        playlistId={playlistId}
        title={title}
        viewerLocked={viewerLocked}
      />
    );
  }

  const viewerControlStyle = viewerLocked
    ? ({
        '--play-button': 'none',
        '--center-play-button': 'none',
        '--bottom-play-button': 'none',
        '--top-play-button': 'none',
        '--seek-backward-button': 'none',
        '--center-seek-backward-button': 'none',
        '--bottom-seek-backward-button': 'none',
        '--top-seek-backward-button': 'none',
        '--seek-forward-button': 'none',
        '--center-seek-forward-button': 'none',
        '--bottom-seek-forward-button': 'none',
        '--top-seek-forward-button': 'none',
        '--time-range': 'none',
        '--bottom-time-range': 'none',
        '--top-time-range': 'none',
        '--time-display': 'none',
        '--duration-display': 'none',
        '--playback-rate-button': 'none',
        '--playback-rate-menu-button': 'none',
        '--media-time-range-display': 'none',
        '--media-time-display-display': 'none',
        '--media-duration-display-display': 'none',
        '--media-play-button-display': 'none',
        '--media-seek-backward-button-display': 'none',
        '--media-seek-forward-button-display': 'none',
        '--media-playback-rate-button-display': 'none',
        '--media-playback-rate-menu-button-display': 'none',
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="relative aspect-video bg-black overflow-hidden max-h-screen rounded-lg">
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        tokens={{ playback: token !== 'placeholder-token' && token !== 'unsigned' ? token : undefined }}
        streamType={kind === 'live' ? 'live' : undefined}
        defaultStreamType={kind === 'live' ? 'live' : 'on-demand'}
        startTime={Math.max(0, playbackPosition || 0)}
        metadata={{
          video_title: title,
        }}
        defaultShowRemainingTime
        defaultHiddenCaptions={false}
        accentColor="#fbcfe8"
        className={`w-full h-full ${viewerLocked ? 'watch-party-locked' : ''}`}
        style={viewerControlStyle}
        nohotkeys={viewerLocked}
        onPlay={canBroadcastAdminControls ? handlePlay : undefined}
        onPause={canBroadcastAdminControls ? handlePause : correctViewerControlAttempt}
        onSeeked={canBroadcastAdminControls ? handleSeek : correctViewerControlAttempt}
        onEnded={handleEnded}
        loop={isHoldScreen}
        autoPlay={isHoldScreen || playbackState === 'playing'}
      />

      {isSyncing && viewerLocked && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1 rounded-full z-10">
          Syncing
        </div>
      )}

      {realtimeHealth !== 'healthy' && (
        <div className={`absolute top-4 right-4 text-casual-dark text-xs px-3 py-1 rounded-full font-medium flex items-center gap-2 z-10 backdrop-blur-sm ${
          realtimeHealth === 'degraded' ? 'bg-casual-yellow/90' : 'bg-casual-pink/90'
        }`}>
          {realtimeHealth === 'degraded' ? 'Connection Degraded' : 'Connection Lost'}
        </div>
      )}

      {isHoldScreen && (
        <div className="absolute top-4 left-4 bg-casual-violet/90 backdrop-blur-sm text-casual-dark text-xs px-3 py-1 rounded-full font-bold flex items-center gap-2 z-10">
          <span>Hold Screen</span>
        </div>
      )}
    </div>
  );
}
