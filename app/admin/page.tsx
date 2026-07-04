'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StreamControl from '@/components/admin/StreamControl';
import VideoPlayer from '@/components/VideoPlayer';
import QueueManager from '@/components/admin/QueueManager';
import VideoPlaylistSettings from '@/components/admin/VideoPlaylistSettings';
import { supabase } from '@/lib/supabase';
import {
  CHANNEL_NAMES,
  DATABASE_TABLES,
} from '@/lib/constants';

interface StreamData {
  playbackId: string;
  token: string;
  title: string;
  kind: string;
  isHoldScreen?: boolean;
  showPoster?: boolean;
  playoutMode?: 'manual' | 'schedule' | string;
  playbackState?: 'playing' | 'paused' | string;
  playbackPosition?: number;
  playbackUpdatedAt?: string;
  playbackElapsedMs?: number;
  activeSlotId?: string | null;
  activeAssetKey?: string | null;
  scheduleStatus?: string | null;
  nextTransitionAt?: string | null;
  scheduleTitle?: string | null;
  sourceType?: string;
  youtubePlaylistId?: string | null;
  youtubeVideoId?: string | null;
  sourceUrl?: string | null;
}

type AdminSection = 'run' | 'media' | 'audience' | 'settings';

const ADMIN_SECTIONS: { id: AdminSection; label: string; description: string }[] = [
  { id: 'run', label: 'Run Show', description: 'Live controls, preview, and queue' },
  { id: 'media', label: 'Media', description: 'Library, imports, and event extras' },
  { id: 'audience', label: 'Audience', description: 'Polls and participation' },
  { id: 'settings', label: 'Settings', description: 'Entry screen and admin options' },
];

function formatTransition(value?: string | null) {
  if (!value) return 'None scheduled';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [posterMode, setPosterMode] = useState(false);
  const [posterLoading, setPosterLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>('run');

  useEffect(() => {
    // Check admin authentication and load stream
    async function checkAuth() {
      try {
        const response = await fetch('/api/admin/set-current');
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        setLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/admin/login');
      }
    }

    async function loadStream() {
      try {
        const response = await fetch('/api/current');
        if (response.ok) {
          const data = await response.json();
          setStreamData(data);
          setPosterMode(data.showPoster || false);
        }
      } catch (error) {
        console.error('Failed to load stream:', error);
      }
    }

    checkAuth();
    loadStream();

    // Reload stream when it changes (for realtime updates)
    const interval = setInterval(() => {
      loadStream();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [router]);

  // Subscribe to hold screen changes to reload immediately
  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAMES.ADMIN_HOLD_SCREEN_UPDATES)
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
            console.log('Stream changed, reloading...');
            fetch('/api/current')
              .then(res => res.json())
              .then(data => {
                setStreamData(data);
              })
              .catch(err => {
                console.error('Failed to reload stream:', err);
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleTogglePoster() {
    setPosterLoading(true);
    try {
      const response = await fetch('/api/admin/toggle-poster', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setPosterMode(data.showPoster);
      } else {
        alert('Failed to toggle poster mode');
      }
    } catch (error) {
      console.error('Failed to toggle poster:', error);
      alert('Error toggling poster mode');
    } finally {
      setPosterLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-twitch-darker flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-twitch-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-twitch-darker text-twitch-text">
      <header className="bg-twitch-dark border-b border-twitch-border">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-twitch-purple">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-twitch-text-alt">
                {ADMIN_SECTIONS.find((section) => section.id === activeSection)?.description}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <a 
                href="/event"
                className="twitch-button-secondary text-sm flex-1 sm:flex-none text-center min-h-[44px] flex items-center justify-center"
              >
                View Stream
              </a>
              <button
                onClick={async () => {
                  await fetch('/api/auth/admin-logout', { method: 'POST' });
                  router.push('/admin/login');
                }}
                className="text-twitch-text-alt hover:text-twitch-text transition-colors min-h-[44px] px-3"
              >
                Logout
              </button>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Admin sections"
            className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 rounded-2xl bg-white/40 p-1 border border-white/50"
          >
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-3 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                  activeSection === section.id
                    ? 'bg-casual-pink text-casual-dark shadow-glow-pink'
                    : 'text-twitch-text-alt hover:bg-white/50'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {streamData && (
          <div className="twitch-card p-4 mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-twitch-text-alt mb-1">Mode</p>
                <p className="font-semibold text-twitch-purple">{streamData.playoutMode || 'schedule'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-twitch-text-alt mb-1">Status</p>
                <p className="font-semibold">{streamData.scheduleStatus || (streamData.isHoldScreen ? 'hold' : 'manual')}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-twitch-text-alt mb-1">Active Slot</p>
                <p className="font-semibold">{streamData.activeSlotId || 'Manual queue'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-twitch-text-alt mb-1">Next Transition</p>
                <p className="font-semibold">{formatTransition(streamData.nextTransitionAt)}</p>
              </div>
            </div>
            <p className="text-xs text-twitch-text-alt mt-3">
              Current source: {streamData.title} • {streamData.sourceType || 'mux'}
            </p>
          </div>
        )}

        {activeSection === 'run' && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)] gap-4 sm:gap-6 items-start">
            <div className="space-y-6">
              <div className="twitch-card p-4">
                <h2 className="text-lg font-semibold mb-3 text-twitch-text">Preview</h2>
                <p className="text-xs text-twitch-text-alt mb-4">
                  Read-only preview. Use manual controls to change viewer playback.
                </p>
                {streamData ? (
                  <VideoPlayer
                    key={`${streamData.sourceType || 'mux'}:${streamData.playbackId}:${streamData.activeSlotId || 'no-slot'}:${streamData.isHoldScreen ? 'hold' : 'movie'}`}
                    playbackId={streamData.playbackId}
                    token={streamData.token}
                    title={streamData.title}
                    kind={streamData.kind}
                    sourceType={streamData.sourceType}
                    youtubePlaylistId={streamData.youtubePlaylistId}
                    youtubeVideoId={streamData.youtubeVideoId}
                    sourceUrl={streamData.sourceUrl}
                    isAdmin={true}
                    allowAdminBroadcast={false}
                    isHoldScreen={streamData.isHoldScreen}
                    playoutMode={streamData.playoutMode}
                    playbackState={streamData.playbackState}
                    playbackPosition={streamData.playbackPosition}
                    playbackUpdatedAt={streamData.playbackUpdatedAt}
                    playbackElapsedMs={streamData.playbackElapsedMs}
                    activeSlotId={streamData.activeSlotId}
                  />
                ) : (
                  <div className="aspect-video bg-twitch-darker flex items-center justify-center rounded">
                    <p className="text-twitch-text-alt">No stream configured. Add media from the Media tab.</p>
                  </div>
                )}
              </div>

              <QueueManager />
            </div>

            <div className="xl:sticky xl:top-6">
              <StreamControl
                showLibraryControls={false}
                showPlaybackControls={true}
                showPollControls={false}
              />
            </div>
          </div>
        )}

        {activeSection === 'media' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
            <div className="xl:col-span-2">
              <StreamControl
                showLibraryControls={true}
                showPlaybackControls={false}
                showPollControls={false}
              />
            </div>
            <div>
              <VideoPlaylistSettings />
            </div>
          </div>
        )}

        {activeSection === 'audience' && (
          <div className="max-w-4xl">
            <StreamControl
              showLibraryControls={false}
              showPlaybackControls={false}
              showPollControls={true}
            />
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="max-w-3xl space-y-6">
            <div className="twitch-card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-twitch-text">Entry Screen</h2>
                  <p className="text-sm text-twitch-text-alt mt-1">
                    {posterMode
                      ? 'Visitors see the event poster with countdown.'
                      : 'Visitors see the registration form.'}
                  </p>
                </div>
                <button
                  onClick={handleTogglePoster}
                  disabled={posterLoading}
                  className={`w-full sm:w-auto px-4 sm:px-6 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] ${
                    posterMode
                      ? 'bg-error/80 hover:bg-error text-white'
                      : 'bg-success hover:bg-green-500 text-casual-dark'
                  }`}
                >
                  {posterLoading ? 'Switching...' : posterMode ? 'Show Registration' : 'Show Poster'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
