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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={async () => {
              await fetch('/api/auth/admin-logout', { method: 'POST' });
              router.push('/admin/login');
            }}
            className="text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <StreamControl />
      </main>
    </div>
  );
}

