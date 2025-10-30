'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StreamControl from '@/components/admin/StreamControl';
import VideoPlayer from '@/components/VideoPlayer';

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
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 py-3">
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
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Preview - Takes 2/3 width */}
          <div className="lg:col-span-2">
            <div className="twitch-card p-4 mb-4">
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
          </div>

          {/* Controls - Takes 1/3 width */}
          <div className="lg:col-span-1">
            <StreamControl />
          </div>
        </div>
      </main>
    </div>
  );
}

