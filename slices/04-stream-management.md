# Slice 04: Stream Management

## Overview
Implement the ability for administrators to dynamically switch between different video streams, with viewers automatically receiving the new content without page refresh.

## Goals
- Create admin API to update current stream
- Implement real-time stream updates for viewers
- Build admin UI for stream selection
- Support both polling and Realtime subscriptions
- Maintain playback position when appropriate

## Dependencies
- **Slice 01**: Project foundation
- **Slice 02**: Authentication system
- **Slice 03**: Video playback

## Technical Requirements

### 1. Admin Stream Control API

**File: `app/api/admin/set-current/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { playbackId, title, kind = 'vod' } = await request.json();

    if (!playbackId || !title) {
      return NextResponse.json(
        { error: 'playbackId and title are required' },
        { status: 400 }
      );
    }

    // Update current stream
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .update({
        playback_id: playbackId,
        title: title,
        kind: kind,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      })
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update stream' },
        { status: 500 }
      );
    }

    // Log admin action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'stream_change',
      admin_user: session.userId,
      details: {
        playback_id: playbackId,
        title: title,
        kind: kind,
      },
    });

    return NextResponse.json({
      success: true,
      updatedAt: data.updated_at,
      stream: data,
    });
  } catch (error) {
    console.error('Error updating stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch current stream' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Mux Assets API

**File: `app/api/admin/mux-items/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('mux_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch Mux items' },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Error fetching Mux items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { playbackId, label, kind = 'vod', durationSeconds } = await request.json();

    if (!playbackId) {
      return NextResponse.json(
        { error: 'playbackId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('mux_items')
      .insert({
        playback_id: playbackId,
        label: label || playbackId,
        kind: kind,
        duration_seconds: durationSeconds,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'This playback ID already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to add Mux item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (error) {
    console.error('Error adding Mux item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. Real-Time Stream Updates Hook

**File: `hooks/useStreamUpdates.ts`**
```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface StreamUpdate {
  playbackId: string;
  title: string;
  kind: string;
  updatedAt: string;
}

export function useStreamUpdates(initialData: StreamUpdate | null) {
  const [streamData, setStreamData] = useState(initialData);
  const [usePolling, setUsePolling] = useState(false);

  // Polling mechanism (fallback)
  const poll = useCallback(async () => {
    try {
      const response = await fetch('/api/current');
      if (response.ok) {
        const data = await response.json();
        setStreamData({
          playbackId: data.playbackId,
          title: data.title,
          kind: data.kind,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, []);

  useEffect(() => {
    if (!initialData) return;

    // Try Supabase Realtime first
    const channel = supabase
      .channel('stream-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'current_stream',
          filter: 'id=eq.1',
        },
        (payload) => {
          console.log('Stream updated via Realtime:', payload);
          const newData = payload.new as any;
          setStreamData({
            playbackId: newData.playback_id,
            title: newData.title,
            kind: newData.kind,
            updatedAt: newData.updated_at,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to stream updates');
          setUsePolling(false);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('Realtime failed, falling back to polling');
          setUsePolling(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialData]);

  // Polling interval
  useEffect(() => {
    if (!usePolling) return;

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [usePolling, poll]);

  return streamData;
}
```

### 4. Enhanced Event Page with Stream Updates

**Update: `app/event/page.tsx`**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { useStreamUpdates } from '@/hooks/useStreamUpdates';

interface StreamData {
  playbackId: string;
  token: string;
  expiresAt: string;
  title: string;
  kind: string;
}

export default function EventPage() {
  const router = useRouter();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Token refresh hook
  useTokenRefresh(streamData, setStreamData);

  // Stream updates hook
  const updatedStream = useStreamUpdates(
    streamData ? {
      playbackId: streamData.playbackId,
      title: streamData.title,
      kind: streamData.kind,
      updatedAt: new Date().toISOString(),
    } : null
  );

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
    async function loadStream() {
      try {
        const response = await fetch('/api/current');

        if (response.status === 401) {
          router.push('/event/login');
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
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No stream available'}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">{streamData.title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
              {streamData.kind === 'live' ? 'Live' : 'Streaming'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <VideoPlayer
              key={streamData.playbackId} // Force remount on stream change
              playbackId={streamData.playbackId}
              token={streamData.token}
              title={streamData.title}
            />
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Chat</h2>
              <p className="text-slate-400 text-sm">Chat will be available here</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### 5. Admin Stream Control Component

**File: `components/admin/StreamControl.tsx`**
```typescript
'use client';

import { useState, useEffect } from 'react';

interface MuxItem {
  id: string;
  playback_id: string;
  label: string;
  kind: string;
  duration_seconds?: number;
}

interface CurrentStream {
  playback_id: string;
  title: string;
  kind: string;
  updated_at: string;
}

export default function StreamControl() {
  const [muxItems, setMuxItems] = useState<MuxItem[]>([]);
  const [currentStream, setCurrentStream] = useState<CurrentStream | null>(null);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [customPlaybackId, setCustomPlaybackId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadMuxItems();
    loadCurrentStream();
  }, []);

  async function loadMuxItems() {
    try {
      const response = await fetch('/api/admin/mux-items');
      if (response.ok) {
        const data = await response.json();
        setMuxItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load Mux items:', error);
    }
  }

  async function loadCurrentStream() {
    try {
      const response = await fetch('/api/admin/set-current');
      if (response.ok) {
        const data = await response.json();
        setCurrentStream(data);
      }
    } catch (error) {
      console.error('Failed to load current stream:', error);
    }
  }

  async function handleSetStream(playbackId: string, title: string, kind: string = 'vod') {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/set-current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbackId, title, kind }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: `Stream updated to: ${title}` });
        setCurrentStream(data.stream);
        setCustomPlaybackId('');
        setCustomTitle('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update stream' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMuxItem() {
    if (!customPlaybackId || !customTitle) {
      setMessage({ type: 'error', text: 'Playback ID and title are required' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/mux-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbackId: customPlaybackId,
          label: customTitle,
          kind: 'vod',
        }),
      });

      if (response.ok) {
        await loadMuxItems();
        setMessage({ type: 'success', text: 'Mux item added successfully' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to add item' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Stream Control</h2>
        
        {currentStream && (
          <div className="bg-slate-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-400 mb-1">Currently Streaming</p>
            <p className="font-semibold">{currentStream.title}</p>
            <p className="text-xs text-slate-400 mt-2">
              {currentStream.playback_id} • {currentStream.kind}
            </p>
            <p className="text-xs text-slate-500">
              Last updated: {new Date(currentStream.updated_at).toLocaleString()}
            </p>
          </div>
        )}

        {message && (
          <div className={`rounded-lg p-4 mb-4 ${
            message.type === 'success' 
              ? 'bg-green-500/10 border border-green-500 text-green-400' 
              : 'bg-red-500/10 border border-red-500 text-red-400'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Select from Library</h3>
        {muxItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No Mux items available. Add one below.</p>
        ) : (
          <div className="space-y-2">
            {muxItems.map(item => (
              <div key={item.id} className="bg-slate-700 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-slate-400 font-mono">{item.playback_id}</p>
                  {item.duration_seconds && (
                    <p className="text-xs text-slate-500">
                      Duration: {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSetStream(item.playback_id, item.label, item.kind)}
                  disabled={loading || currentStream?.playback_id === item.playback_id}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {currentStream?.playback_id === item.playback_id ? 'Current' : 'Make Current'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Add New Mux Item</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Playback ID
            </label>
            <input
              type="text"
              value={customPlaybackId}
              onChange={(e) => setCustomPlaybackId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="e.g., abc123xyz456"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title/Label
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              placeholder="e.g., Opening Segment"
              disabled={loading}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMuxItem}
              disabled={loading || !customPlaybackId || !customTitle}
              className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
            >
              Add to Library
            </button>
            <button
              onClick={() => {
                if (customPlaybackId && customTitle) {
                  handleSetStream(customPlaybackId, customTitle);
                }
              }}
              disabled={loading || !customPlaybackId || !customTitle}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
            >
              Add & Make Current
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6. Basic Admin Page

**File: `app/admin/page.tsx`**
```typescript
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
              await fetch('/api/auth/logout', { method: 'POST' });
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
```

## Implementation Tasks

- [ ] Create `/api/admin/set-current` endpoint (POST and GET)
- [ ] Create `/api/admin/mux-items` endpoint (GET and POST)
- [ ] Create `useStreamUpdates` hook with Realtime + polling fallback
- [ ] Update event page to handle stream updates
- [ ] Create `StreamControl` admin component
- [ ] Create admin dashboard page
- [ ] Enable Supabase Realtime for `current_stream` table
- [ ] Test stream switching with multiple viewers
- [ ] Test Realtime subscription
- [ ] Test polling fallback
- [ ] Verify video player remounts on stream change
- [ ] Test with multiple Mux assets

## Acceptance Criteria

✅ **Admin Stream Control:**
- [ ] Admin can add Mux items to library
- [ ] Admin can select stream from library
- [ ] Admin can manually enter playback ID
- [ ] Current stream is clearly indicated
- [ ] Success/error messages displayed
- [ ] Changes logged in `admin_actions` table

✅ **Viewer Stream Updates:**
- [ ] Stream changes detected automatically
- [ ] New video loads without page refresh
- [ ] Switch latency < 3 seconds
- [ ] No playback interruption (smooth transition)
- [ ] Title updates in header
- [ ] Works with both Realtime and polling

✅ **Real-Time Mechanism:**
- [ ] Supabase Realtime subscription works
- [ ] Falls back to polling on Realtime failure
- [ ] Polling interval is 3 seconds
- [ ] Connection status logged to console
- [ ] Multiple viewers receive updates simultaneously

✅ **Error Handling:**
- [ ] Invalid playback ID shows error
- [ ] Network errors handled gracefully
- [ ] Duplicate playback IDs prevented
- [ ] Missing fields show validation errors

## Testing

**Manual Tests:**

1. **Single Viewer Stream Switch:**
   - Login as admin → change stream
   - Open viewer page in different browser
   - Verify video changes within 3 seconds
   - Check console for Realtime logs

2. **Multiple Viewers:**
   - Open 3-5 viewer windows
   - Admin changes stream
   - Verify all viewers update simultaneously
   - Check network tab for polling/Realtime

3. **Polling Fallback:**
   - Disable Realtime (block WebSocket in DevTools)
   - Verify polling kicks in
   - Admin changes stream
   - Verify update happens within 3 seconds

4. **Admin UI:**
   - Add new Mux item
   - Verify it appears in library
   - Switch between multiple streams
   - Verify current stream indication
   - Check admin actions logged in database

**Load Test:**
```bash
# Test with 30 concurrent viewers
# Use artillery or k6 to simulate viewers
# Admin changes stream
# Measure update latency across all viewers
```

## Notes

- Use `key={streamData.playbackId}` to force React remount on stream change
- Realtime requires WebSocket support (blocked by some corporate networks)
- Polling is acceptable fallback (3s latency)
- Consider adding stream schedule/playlist in future
- Admin actions audit log is crucial for debugging

## Troubleshooting

**Viewers not updating:**
- Check Realtime status in console
- Verify WebSocket connection
- Test polling directly
- Check database `current_stream` table

**Duplicate playback IDs:**
- Use UNIQUE constraint on `playback_id`
- Show user-friendly error message
- Admin can still switch to existing item

**Slow updates:**
- Check polling interval (3s default)
- Verify Realtime subscription
- Check network latency
- Consider WebSocket proxy if blocked

## Next Slice

After completing stream management, proceed to **Slice 05: Real-Time Chat System** to implement viewer chat functionality.

