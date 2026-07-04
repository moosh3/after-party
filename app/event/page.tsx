'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VideoPlayer from '@/components/VideoPlayer';
import Chat from '@/components/Chat';
import PollsTab from '@/components/PollsTab';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { useStreamUpdates } from '@/hooks/useStreamUpdates';
import { getViewerData } from '@/lib/viewer';
import { supabase } from '@/lib/supabase';
import {
  ROOM_NAMES,
  CHANNEL_NAMES,
  DATABASE_TABLES,
} from '@/lib/constants';
import { LL_FONT_VARS } from '@/components/lobby-lounge/fonts';
import { LL } from '@/components/lobby-lounge/tokens';
import LLHeader from '@/components/lobby-lounge/LLHeader';
import { LLPill } from '@/components/lobby-lounge/buttons';
import DoorsCountdown from '@/components/lobby-lounge/DoorsCountdown';
import Reel from '@/components/lobby-lounge/Reel';
import MiniAvatar from '@/components/lobby-lounge/MiniAvatar';
import PresenceToasts from '@/components/lobby-lounge/PresenceToasts';
import { useLobbyPresence } from '@/components/lobby-lounge/useLobbyPresence';
import '@/components/lobby-lounge/lobby-lounge.css';

interface StreamData {
  playbackId: string;
  token: string;
  expiresAt: string;
  title: string;
  kind: string;
  showPoster?: boolean;
  isHoldScreen?: boolean;
  playoutMode?: 'manual' | 'schedule' | string;
  playbackState?: 'playing' | 'paused' | string;
  playbackPosition?: number;
  playbackUpdatedAt?: string;
  playbackElapsedMs?: number;
  activeSlotId?: string | null;
  scheduleStatus?: string | null;
  nextTransitionAt?: string | null;
  sourceType?: string;
  youtubePlaylistId?: string | null;
  sourceUrl?: string | null;
  captionUrl?: string | null;
  captionLabel?: string | null;
  captionLanguage?: string | null;
}

function ScreenChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className={`dm-lobby-lounge ${LL_FONT_VARS}`} style={{ minHeight: '100vh', background: LL.ink, color: LL.frost1 }}>
      {children}
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <ScreenChrome>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 12, justifyItems: 'center' }}>
          <Reel size={72} mood="sleepy" />
          <p className="f-comic" style={{ color: LL.frost2 }}>
            {message}
          </p>
        </div>
      </div>
    </ScreenChrome>
  );
}

export default function EventPage() {
  const router = useRouter();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [viewerName, setViewerName] = useState<string>('');
  const [viewerAvatar, setViewerAvatar] = useState<string>('');
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
      sourceType: streamData.sourceType,
      updatedAt: streamData.expiresAt || new Date().toISOString(),
    };
  }, [streamData]);

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

  useEffect(() => {
    if (!streamData || streamData.playoutMode !== 'schedule') return;

    let timeout: number | undefined;

    const refreshScheduleStream = async () => {
      try {
        const response = await fetch('/api/current');
        if (!response.ok) return;

        const next = await response.json();
        setStreamData((previous) => {
          if (
            !previous ||
            previous.playbackId !== next.playbackId ||
            previous.title !== next.title ||
            previous.isHoldScreen !== next.isHoldScreen ||
            previous.activeSlotId !== next.activeSlotId ||
            previous.scheduleStatus !== next.scheduleStatus ||
            previous.nextTransitionAt !== next.nextTransitionAt ||
            previous.captionUrl !== next.captionUrl
          ) {
            return next;
          }

          return previous;
        });
        setShowPoster(next.showPoster || false);
      } catch (err) {
        console.error('Failed to refresh scheduled stream:', err);
      }
    };

    const nextTransitionMs = streamData.nextTransitionAt
      ? new Date(streamData.nextTransitionAt).getTime() - Date.now() + 500
      : 30000;
    timeout = window.setTimeout(
      refreshScheduleStream,
      Math.max(1000, Math.min(nextTransitionMs, 30000))
    );

    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [streamData]);

  // Subscribe to hold screen changes specifically
  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAMES.HOLD_SCREEN_UPDATES)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: DATABASE_TABLES.CURRENT_STREAM,
          filter: 'id=eq.1',
        },
        (payload: any) => {
          const newData = payload.new;
          const oldData = payload.old;

          if (
            newData.hold_screen_enabled !== oldData.hold_screen_enabled ||
            newData.playback_id !== oldData.playback_id ||
            newData.playout_mode !== oldData.playout_mode ||
            newData.schedule_early_ended_slot !== oldData.schedule_early_ended_slot ||
            newData.last_command_id !== oldData.last_command_id
          ) {
            console.log('Stream state changed, refetching stream data...');
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
      setViewerName(viewerData.displayName);
      setViewerAvatar(viewerData.avatar);
    }

    checkPosterMode();
    setCheckingRegistration(false);
  }, []);

  // Subscribe to poster mode changes in realtime
  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAMES.POSTER_MODE_UPDATES)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: DATABASE_TABLES.CURRENT_STREAM,
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
    const emojis = ['🎬', '🍿', '🎥', '⭐', '🕹️', '📼'];
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
      .channel(CHANNEL_NAMES.EASTER_EGGS)
      .on('broadcast', { event: 'trigger' }, () => {
        spawnEasterEmojis();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spawnEasterEmojis]);

  useEffect(() => {
    document.title = 'Watch · Da Movies';
  }, []);

  // First Mux playback error is likely a stale signed token (e.g. after the
  // phone slept) — refetch stream data so the player gets a fresh one.
  // Where the movie is right now, read from the live player — attached to
  // chat messages so people can see which scene a message was about.
  const getSceneStamp = useCallback(() => {
    if (
      !streamData ||
      streamData.isHoldScreen ||
      (streamData.sourceType && streamData.sourceType !== 'mux')
    ) {
      return null;
    }

    const player = document.querySelector('mux-player') as { currentTime?: number } | null;
    const position = player?.currentTime;
    if (typeof position !== 'number' || !Number.isFinite(position) || position <= 0) {
      return null;
    }

    return { position, playbackId: streamData.playbackId };
  }, [streamData]);

  const handlePlaybackError = useCallback(() => {
    fetch('/api/current')
      .then((res) => res.json())
      .then((data) => setStreamData(data))
      .catch((err) => {
        console.error('Failed to refresh stream after player error:', err);
      });
  }, []);

  // Redirect to login if not registered (once poster/registration check has run)
  useEffect(() => {
    if (checkingRegistration) return;
    if (!isRegistered && !showPoster) {
      router.replace('/login');
    }
  }, [checkingRegistration, isRegistered, showPoster, router]);

  const presenceSelf = isRegistered && userId ? { userId, displayName: viewerName, avatar: viewerAvatar } : null;
  const viewersHere = useLobbyPresence(presenceSelf);

  if (checkingRegistration) {
    return <LoadingScreen message="loading…" />;
  }

  // Doors aren't open yet
  if (showPoster && !isRegistered) {
    return (
      <ScreenChrome>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 24,
          }}
        >
          <Reel size={90} mood="cheer" />
          <DoorsCountdown />
        </main>
      </ScreenChrome>
    );
  }

  // Not registered and doors are open — redirecting to /login
  if (!isRegistered) {
    return <LoadingScreen message="heading to the door…" />;
  }

  if (loading) {
    return <LoadingScreen message="loading stream…" />;
  }

  if (error || !streamData) {
    return (
      <ScreenChrome>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center' }}>
            <p className="f-comic" style={{ color: LL.frost2 }}>
              {error || 'No stream available'}
            </p>
            <button type="button" onClick={() => window.location.reload()} className="bevel-btn f-display" style={{
              padding: '10px 20px', borderRadius: 8, color: LL.ink,
              background: `linear-gradient(180deg, ${LL.frost1} 0%, ${LL.lime} 55%, #95cc1f 100%)`,
            }}>
              RETRY
            </button>
          </div>
        </div>
      </ScreenChrome>
    );
  }

  return (
    <div className={`dm-lobby-lounge ${LL_FONT_VARS} ll-watch-root`} style={{ background: LL.ink, color: LL.frost1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        /* Height lives here (not inline) so the dvh fallback chain applies:
           dvh tracks Chrome mobile's collapsing URL bar. */
        .ll-watch-root { height: 100vh; height: 100dvh; }

        /* Desktop: video top-left, extras under it, chat spans the right column. */
        .ll-watch-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          grid-template-rows: auto minmax(0, 1fr);
          grid-template-areas: "video chat" "extras chat";
          gap: 14px; padding: 14px; flex: 1; min-height: 0; overflow: hidden;
        }
        .ll-watch-below { display: contents; }
        .ll-watch-video { grid-area: video; }
        .ll-watch-extras { grid-area: extras; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .ll-watch-chat { grid-area: chat; min-height: 0; }

        .ll-nowplaying { display: flex; gap: 14px; align-items: center; font-size: 14px; padding: 6px 16px; }
        .ll-nowplaying-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ll-nowplaying-right { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .ll-nowplaying-avatars { display: flex; }

        @media (max-width: 900px) {
          /* Video pinned at top; one scroll region below where chat exactly
             fills the visible space and polls/extras sit past the fold. */
          .ll-watch-grid { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
          .ll-watch-video { flex-shrink: 0; }
          .ll-watch-below { display: block; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
          .ll-watch-chat { display: block; height: 100%; }
          .ll-watch-extras { margin-top: 8px; }

          .ll-nowplaying { font-size: 12px; gap: 8px; padding: 4px 10px; }
          .ll-nowplaying-avatars { display: none; }
        }
      `}</style>
      <a className="skip-link" href="#ll-watch-main">
        Skip to content
      </a>
      <LLHeader
        compact
        tagline="where we like to watch movies"
        lockText="MEMBERS ONLY · QUIET PLEASE"
        timestamp="CAGE-A-THON"
        actions={
          <>
            <LLPill as={Link} href="/home">🏠 HOME</LLPill>
            <LLPill as={Link} href="/schedule">🗓 SCHEDULE</LLPill>
          </>
        }
      />

      {tokenRefreshError && (
        <div style={{ background: 'rgba(255,230,0,.15)', borderBottom: `1px solid ${LL.yellow}`, color: LL.yellow, fontSize: 13, padding: '6px 16px', textAlign: 'center' }}>
          {tokenRefreshError}
        </div>
      )}

      <div
        className="f-mono ll-nowplaying"
        style={{
          background: LL.deep,
          color: LL.mint,
          borderBottom: `2px solid ${LL.ink}`,
        }}
      >
        <span style={{ color: LL.lime, flexShrink: 0 }}>NOW PLAYING ·</span>
        <strong
          className="ll-nowplaying-title"
          style={{ color: LL.frost1, cursor: 'pointer' }}
          onClick={spawnEasterEmojis}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && spawnEasterEmojis()}
        >
          {streamData.title}
        </strong>
        {viewersHere.length > 0 && (
          <div className="ll-nowplaying-right">
            <span className="now-pill">
              <span className="dot" />
              LIVE
            </span>
            <div className="ll-nowplaying-avatars">
              {viewersHere.slice(0, 8).map((v, i) => (
                <div key={v.userId} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <MiniAvatar avatarId={v.avatar} size={26} ring={LL.mint} />
                </div>
              ))}
            </div>
            <span style={{ color: LL.frost2, whiteSpace: 'nowrap' }}>{viewersHere.length} in the room</span>
          </div>
        )}
      </div>

      <main id="ll-watch-main" className="ll-watch-grid">
        <div
          className="ll-watch-video"
          style={{
            position: 'relative',
            background: '#000',
            border: `3px solid ${LL.ink}`,
            borderRadius: 6,
            overflow: 'hidden',
            boxShadow: '4px 4px 0 rgba(0,0,0,.5)',
          }}
        >
            <ErrorBoundary
              fallback={
                <div style={{ aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <p className="f-comic" style={{ color: LL.frost2, marginBottom: 12 }}>Video player encountered an error</p>
                    <button type="button" onClick={() => window.location.reload()} className="bevel-btn f-display" style={{
                      padding: '8px 16px', borderRadius: 8, color: LL.ink,
                      background: `linear-gradient(180deg, ${LL.frost1} 0%, ${LL.lime} 55%, #95cc1f 100%)`,
                    }}>
                      REFRESH
                    </button>
                  </div>
                </div>
              }
            >
              <VideoPlayer
                key={`${streamData.sourceType || 'mux'}:${streamData.playbackId}:${streamData.activeSlotId || 'no-slot'}:${streamData.isHoldScreen ? 'hold' : 'movie'}`}
                playbackId={streamData.playbackId}
                token={streamData.token}
                title={streamData.title}
                kind={streamData.kind}
                sourceType={streamData.sourceType}
                youtubePlaylistId={streamData.youtubePlaylistId}
                sourceUrl={streamData.sourceUrl}
                isHoldScreen={streamData.isHoldScreen}
                playoutMode={streamData.playoutMode}
                playbackState={streamData.playbackState}
                playbackPosition={streamData.playbackPosition}
                playbackUpdatedAt={streamData.playbackUpdatedAt}
                playbackElapsedMs={streamData.playbackElapsedMs}
                activeSlotId={streamData.activeSlotId}
                captionUrl={streamData.captionUrl}
                captionLabel={streamData.captionLabel}
                captionLanguage={streamData.captionLanguage}
                onPlaybackError={handlePlaybackError}
              />
            </ErrorBoundary>
            <ErrorBoundary fallback={null}>
              <PresenceToasts viewers={viewersHere} selfId={userId} />
            </ErrorBoundary>
        </div>

        <div className="ll-watch-below">
          <aside className="ll-watch-chat">
            <ErrorBoundary
              fallback={
                <div style={{ height: '100%', background: LL.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <p className="f-comic" style={{ color: LL.frost2, fontSize: 13, marginBottom: 8 }}>Chat unavailable</p>
                    <button type="button" onClick={() => window.location.reload()} style={{ color: LL.lime, fontSize: 12, textDecoration: 'underline', background: 'none', border: 0, cursor: 'pointer' }}>
                      Reload to fix
                    </button>
                  </div>
                </div>
              }
            >
              <Chat room={ROOM_NAMES.DEFAULT} userId={userId} getSceneStamp={getSceneStamp} />
            </ErrorBoundary>
          </aside>

          <div className="ll-watch-extras">
            <div style={{ textAlign: 'center' }}>
              <a
                href="https://www.youtube.com/playlist?list=PLsTN7jx6BmIkqKbcU_HeUo3YRbEn9OGZh"
                target="_blank"
                rel="noopener noreferrer"
                className="f-display bevel-btn"
                style={{
                  display: 'inline-block',
                  padding: '5px 12px',
                  borderRadius: 8,
                  color: LL.ink,
                  background: `linear-gradient(180deg, ${LL.frost1} 0%, ${LL.mint} 60%, #7eb9a0 100%)`,
                  textDecoration: 'none',
                  fontSize: 11,
                }}
              >
                ◄ CLIP SHOW ►
              </a>
            </div>

            <div>
              <h3 className="f-display" style={{ textAlign: 'center', color: LL.lime, fontSize: 12, marginBottom: 4 }}>
                ★ POLLS ★
              </h3>
              <ErrorBoundary
                fallback={
                  <p className="f-comic" style={{ textAlign: 'center', color: LL.frost2, fontSize: 13 }}>Polls unavailable</p>
                }
              >
                <PollsTab userId={userId} room={ROOM_NAMES.DEFAULT} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
