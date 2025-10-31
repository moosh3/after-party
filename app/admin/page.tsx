'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StreamControl from '@/components/admin/StreamControl';
import VideoPlayer from '@/components/VideoPlayer';
import QueueManager from '@/components/admin/QueueManager';

interface StreamData {
  playbackId: string;
  token: string;
  title: string;
  kind: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [posterMode, setPosterMode] = useState(false);
  const [posterLoading, setPosterLoading] = useState(false);

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
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-twitch-purple">Admin Dashboard</h1>
              <p className="text-sm text-twitch-text-alt">Manage your stream</p>
            </div>
            <div className="flex items-center gap-3">
              <a 
                href="/event"
                className="twitch-button-secondary text-sm"
              >
                View Stream
              </a>
              <button
                onClick={async () => {
                  await fetch('/api/auth/admin-logout', { method: 'POST' });
                  router.push('/admin/login');
                }}
                className="text-twitch-text-alt hover:text-twitch-text transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
          
          {/* Entry Screen Mode Toggle */}
          <div className="mt-4 pt-4 border-t border-twitch-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-twitch-text mb-1">Entry Screen Mode</h3>
                <p className="text-xs text-twitch-text-alt">
                  {posterMode 
                    ? 'Visitors see the event poster with countdown'
                    : 'Visitors see the registration form'
                  }
                </p>
              </div>
              <button
                onClick={handleTogglePoster}
                disabled={posterLoading}
                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  posterMode
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white'
                    : 'bg-gradient-to-r from-success to-green-600 hover:from-green-500 hover:to-success text-white'
                }`}
              >
                {posterLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Switching...
                  </span>
                ) : posterMode ? (
                  <span className="flex items-center gap-2">
                    🎬 POSTER MODE
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    📝 REGISTRATION MODE
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Video Preview and Library Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Preview */}
            <div className="twitch-card p-4">
              <h2 className="text-lg font-semibold mb-3 text-twitch-text">Video Preview</h2>
              <p className="text-xs text-twitch-text-alt mb-4">
                Control playback directly here - changes sync to all viewers
              </p>
              {streamData ? (
                <VideoPlayer
                  key={streamData.playbackId}
                  playbackId={streamData.playbackId}
                  token={streamData.token}
                  title={streamData.title}
                  isAdmin={true}
                />
              ) : (
                <div className="aspect-video bg-twitch-darker flex items-center justify-center rounded">
                  <p className="text-twitch-text-alt">No stream configured. Add a video below.</p>
                </div>
              )}
            </div>

            {/* Library Controls - Below Video Preview */}
            <StreamControl showLibraryControls={true} showPlaybackControls={false} />
          </div>

          {/* Right Column - Playback Controls and Queue */}
          <div className="lg:col-span-1 space-y-6">
            <StreamControl showLibraryControls={false} showPlaybackControls={true} />
            <QueueManager />
          </div>
        </div>
      </main>
    </div>
  );
}

