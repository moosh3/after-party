# Slice 05: Real-Time Chat System

## Overview
Implement a real-time chat system using Supabase Realtime, allowing viewers to send messages and interact during the event with rate limiting and moderation capabilities.

## Goals
- Build chat UI component with auto-scroll
- Implement chat message API with rate limiting
- Set up Supabase Realtime for instant message delivery
- Display user count and system messages
- Add basic moderation features

## Dependencies
- **Slice 01**: Project foundation
- **Slice 02**: Authentication system
- **Slice 03**: Video playback (for integration)

## Technical Requirements

### 1. Chat Message API

**File: `app/api/chat/send/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { room = 'event', userName, body } = await request.json();

    if (!userName || !body) {
      return NextResponse.json(
        { error: 'userName and body are required' },
        { status: 400 }
      );
    }

    if (body.length > 600) {
      return NextResponse.json(
        { error: 'Message too long (max 600 characters)' },
        { status: 400 }
      );
    }

    // Check rate limit
    const { data: throttle } = await supabaseAdmin
      .from('chat_throttle')
      .select('last_msg_at')
      .eq('user_id', session.userId)
      .single();

    if (throttle) {
      const lastMessageTime = new Date(throttle.last_msg_at).getTime();
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTime;
      const rateLimitMs = 2000; // 2 seconds

      if (timeSinceLastMessage < rateLimitMs) {
        const waitTime = Math.ceil((rateLimitMs - timeSinceLastMessage) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitTime} seconds before sending another message` },
          { status: 429 }
        );
      }
    }

    // Sanitize message (basic)
    const sanitizedBody = body
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();

    if (!sanitizedBody) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        room,
        user_id: session.userId,
        user_name: userName,
        kind: 'user',
        body: sanitizedBody,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert message:', error);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Update rate limit
    await supabaseAdmin
      .from('chat_throttle')
      .upsert({
        user_id: session.userId,
        last_msg_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      id: message.id,
      createdAt: message.created_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Chat Messages Fetch API

**File: `app/api/chat/messages/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room') || 'event';
    const limit = parseInt(searchParams.get('limit') || '100');

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room', room)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Reverse to get chronological order
    const sortedMessages = (messages || []).reverse();

    return NextResponse.json({ messages: sortedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. Chat Component

**File: `components/Chat.tsx`**
```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Message {
  id: number;
  user_id: string;
  user_name: string;
  body: string;
  kind: 'user' | 'system' | 'poll';
  created_at: string;
}

interface ChatProps {
  room?: string;
  userId: string;
}

export default function Chat({ room = 'event', userId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load user name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('chat_username');
    if (savedName) {
      setUserName(savedName);
    } else {
      const randomName = `Guest${Math.floor(Math.random() * 1000)}`;
      setUserName(randomName);
      localStorage.setItem('chat_username', randomName);
    }
  }, []);

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(`/api/chat/messages?room=${room}&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [room]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${room}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room=eq.${room}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom = 
        container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      setAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Rate limit countdown
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;

    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageBody.trim() || sending || rateLimitSeconds > 0) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room,
          userName,
          body: messageBody.trim(),
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        const match = data.error.match(/(\d+) seconds/);
        if (match) {
          setRateLimitSeconds(parseInt(match[1]));
        }
        setError(data.error);
      } else if (!response.ok) {
        setError(data.error || 'Failed to send message');
      } else {
        setMessageBody('');
        setRateLimitSeconds(2); // Reset rate limit timer
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  }

  function getAvatarColor(name: string): string {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold">Chat</h2>
        <p className="text-xs text-slate-400">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </p>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: '400px' }}
      >
        {messages.length === 0 ? (
          <p className="text-slate-400 text-sm text-center">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full ${getAvatarColor(message.user_name)} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                {message.user_name.charAt(0).toUpperCase()}
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm">{message.user_name}</span>
                  <span className="text-xs text-slate-500">
                    {formatTimestamp(message.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-200 break-words">{message.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom indicator */}
      {!autoScroll && (
        <div className="px-4 py-2">
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setAutoScroll(true);
            }}
            className="w-full text-xs text-blue-400 hover:text-blue-300 py-1"
          >
            ↓ New messages
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        {error && (
          <div className="text-xs text-red-400 mb-2">{error}</div>
        )}
        
        <form onSubmit={handleSend} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending || rateLimitSeconds > 0}
              maxLength={600}
            />
            <button
              type="submit"
              disabled={sending || !messageBody.trim() || rateLimitSeconds > 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
          
          {rateLimitSeconds > 0 && (
            <p className="text-xs text-slate-400">
              You can send another message in {rateLimitSeconds}s
            </p>
          )}

          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>{messageBody.length}/600</span>
            <button
              type="button"
              onClick={() => {
                const newName = prompt('Enter your name:', userName);
                if (newName && newName.trim()) {
                  setUserName(newName.trim());
                  localStorage.setItem('chat_username', newName.trim());
                }
              }}
              className="text-blue-400 hover:text-blue-300"
            >
              Change name ({userName})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4. System Messages Utility

**File: `lib/chat.ts`**
```typescript
import { supabaseAdmin } from './supabase';

export async function sendSystemMessage(
  room: string,
  body: string
): Promise<void> {
  try {
    await supabaseAdmin.from('messages').insert({
      room,
      user_id: 'system',
      user_name: 'System',
      kind: 'system',
      body,
    });
  } catch (error) {
    console.error('Failed to send system message:', error);
  }
}

export async function getActiveUserCount(room: string): Promise<number> {
  // This is a simplified version
  // In production, you'd track active connections via Supabase Presence
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('user_id')
      .eq('room', room)
      .gte('created_at', fiveMinutesAgo);

    if (error) return 0;

    const uniqueUsers = new Set(data.map(m => m.user_id));
    return uniqueUsers.size;
  } catch (error) {
    console.error('Failed to get user count:', error);
    return 0;
  }
}
```

### 5. Update Event Page with Chat

**Update: `app/event/page.tsx`** (add Chat component)
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import Chat from '@/components/Chat';
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
  const [userId, setUserId] = useState<string>('');

  useTokenRefresh(streamData, setStreamData);
  const updatedStream = useStreamUpdates(
    streamData ? {
      playbackId: streamData.playbackId,
      title: streamData.title,
      kind: streamData.kind,
      updatedAt: new Date().toISOString(),
    } : null
  );

  useEffect(() => {
    if (!updatedStream || !streamData) return;

    if (updatedStream.playbackId !== streamData.playbackId) {
      console.log('Stream changed, fetching new token...');
      
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

        // Generate or retrieve user ID
        let storedUserId = localStorage.getItem('user_id');
        if (!storedUserId) {
          storedUserId = `viewer_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem('user_id', storedUserId);
        }
        setUserId(storedUserId);
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
              key={streamData.playbackId}
              playbackId={streamData.playbackId}
              token={streamData.token}
              title={streamData.title}
            />
          </div>

          <div className="lg:col-span-1">
            <Chat room="event" userId={userId} />
          </div>
        </div>
      </main>
    </div>
  );
}
```

### 6. Admin Message Moderation API

**File: `app/api/admin/messages/delete/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSession();
  
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete message' },
        { status: 500 }
      );
    }

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'message_delete',
      admin_user: session.userId,
      details: { message_id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Implementation Tasks

- [ ] Create `/api/chat/send` endpoint with rate limiting
- [ ] Create `/api/chat/messages` endpoint
- [ ] Create `/api/admin/messages/delete` endpoint
- [ ] Create `Chat` component with real-time updates
- [ ] Implement auto-scroll with manual override
- [ ] Add rate limit countdown timer
- [ ] Create system message utility
- [ ] Update event page to include chat
- [ ] Enable Supabase Realtime for `messages` table
- [ ] Test message delivery across multiple clients
- [ ] Test rate limiting (2 seconds per message)
- [ ] Test chat with 30+ concurrent users

## Acceptance Criteria

✅ **Chat Functionality:**
- [ ] Messages appear instantly for all users
- [ ] Message delivery latency < 500ms
- [ ] Chat supports 600 character messages
- [ ] Auto-scroll works when at bottom
- [ ] Manual scroll disables auto-scroll
- [ ] "New messages" indicator when scrolled up

✅ **Rate Limiting:**
- [ ] Users can send 1 message per 2 seconds
- [ ] Rate limit enforced server-side
- [ ] Countdown timer shows time remaining
- [ ] Error message shown if rate limited
- [ ] Rate limit resets after 2 seconds

✅ **User Experience:**
- [ ] Random guest names generated
- [ ] Users can change their name
- [ ] Name persists in localStorage
- [ ] Avatar color based on name
- [ ] Relative timestamps (e.g., "2m ago")
- [ ] Character count displayed (X/600)

✅ **Moderation:**
- [ ] Admin can delete messages
- [ ] Deleted messages soft-deleted (audit retained)
- [ ] Basic HTML escaping prevents XSS
- [ ] Empty messages rejected

## Testing

**Manual Tests:**

1. **Basic Chat:**
   - Send message → appears instantly
   - Open second browser → see same messages
   - Send from second browser → appears in first

2. **Rate Limiting:**
   - Send message
   - Try to send immediately → should be blocked
   - Wait 2 seconds → can send again
   - Verify countdown timer

3. **Auto-Scroll:**
   - Load chat with many messages
   - Scroll to top
   - New message arrives → should NOT auto-scroll
   - Scroll to bottom → new message SHOULD auto-scroll
   - Click "New messages" → scrolls to bottom

4. **User Names:**
   - First visit → random name assigned
   - Change name → updates in chat
   - Refresh page → name persists
   - Clear localStorage → new random name

5. **Concurrent Users:**
   - Open 5+ browser windows
   - Send messages from each
   - Verify all receive messages
   - Check timestamps are relative

**Load Test:**
```bash
# Simulate 30 concurrent users sending messages
# Use artillery or k6
# Measure message delivery latency
# Verify rate limiting enforced
```

## Notes

- Use Supabase Realtime for instant delivery
- Rate limiting prevents spam (1 msg / 2 seconds)
- Soft delete preserves audit trail
- Auto-scroll UX is critical (manual override important)
- Guest names make chat feel more personal
- Consider emoji support in future enhancement

## Troubleshooting

**Messages not appearing:**
- Check Realtime subscription status
- Verify RLS policies allow inserts
- Check browser console for errors
- Test direct database insert

**Rate limiting not working:**
- Verify server-side enforcement
- Check `chat_throttle` table
- Ensure `user_id` is consistent

**XSS vulnerability:**
- Ensure HTML escaping in place
- Test with `<script>alert('xss')</script>`
- Verify React's default escaping

## Next Slice

After completing the chat system, proceed to **Slice 06: Polling System** to implement interactive polls within the chat.

