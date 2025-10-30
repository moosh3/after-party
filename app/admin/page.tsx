'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StreamControl from '@/components/admin/StreamControl';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check admin authentication
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

    checkAuth();
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
        <StreamControl />
      </main>
    </div>
  );
}

