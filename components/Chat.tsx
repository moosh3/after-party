'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getViewerData } from '@/lib/viewer';
import PollCard from './PollCard';
import {
  ROOM_NAMES,
  CHANNEL_NAMES,
  DATABASE_TABLES,
  CHAT_SLOWMODE_SECONDS,
  MAX_MESSAGE_LENGTH,
} from '@/lib/constants';

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

export default function Chat({ room = ROOM_NAMES.DEFAULT, userId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load user name from viewer registration data
  useEffect(() => {
    const viewerData = getViewerData();
    if (viewerData?.displayName) {
      setUserName(viewerData.displayName);
    } else {
      // Fallback for guests who haven't registered
      const randomName = `Guest${Math.floor(Math.random() * 1000)}`;
      setUserName(randomName);
    }
  }, []);

  // Load (or reload) the message list. Also used to backfill anything missed
  // while the realtime socket was dead — mobile browsers kill websockets
  // aggressively when the tab backgrounds or the phone locks.
  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat/messages?room=${room}&limit=100`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        const fetched: Message[] = data.messages || [];
        // Keep any realtime messages that arrived while the fetch was in
        // flight (they'd be newer than the last row the server returned).
        setMessages((prev) => {
          const fetchedIds = new Set(fetched.map((m) => m.id));
          const newer = prev.filter(
            (m) => !fetchedIds.has(m.id) && m.id > (fetched[fetched.length - 1]?.id ?? 0)
          );
          return [...fetched, ...newer];
        });
      } else {
        // Development mode: Show a helpful system message
        console.log('⚠️  Development mode: Chat requires Supabase configuration');
        setMessages([{
          id: 1,
          user_id: 'system',
          user_name: 'System',
          body: '💡 Chat is ready! Configure Supabase in .env.local to enable real-time messaging.',
          kind: 'system' as const,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([{
        id: 1,
        user_id: 'system',
        user_name: 'System',
        body: '⚠️ Unable to connect to chat server. Check your network connection.',
        kind: 'system' as const,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [room]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Refetch when the tab becomes visible again — the realtime channel may
  // have silently dropped messages while the phone was asleep.
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        loadMessages();
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('pageshow', handleResume);
    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, [loadMessages]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAMES.CHAT_ROOM(room))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: DATABASE_TABLES.MESSAGES,
          filter: `room=eq.${room}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe((status) => {
        // Fires on initial join AND every rejoin after a reconnect — refetch
        // so messages inserted while the socket was down aren't lost.
        if (status === 'SUBSCRIBED') {
          loadMessages();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, loadMessages]);

  // Auto-scroll to bottom. Scroll only the messages container —
  // scrollIntoView also scrolls ancestor containers, which yanks the
  // mobile video/chat layout on every incoming message.
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll, scrollToBottom]);

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
          userId,
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
        if (/easter/i.test(messageBody)) {
          supabase.channel(CHANNEL_NAMES.EASTER_EGGS).send({
            type: 'broadcast',
            event: 'trigger',
            payload: {},
          });
        }
        setMessageBody('');
        setRateLimitSeconds(CHAT_SLOWMODE_SECONDS);
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

  function getUsernameColor(name: string): string {
    // Casual warm username colors
    const colors = [
      '#fbbf24', '#f472b6', '#a78bfa', '#60a5fa', '#34d399',
      '#f97316', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981',
      '#f59e0b', '#d946ef', '#7c3aed', '#0ea5e9', '#14b8a6',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#f5fbff' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#a18ad4' }}></div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: 'var(--ll-f-outfit), system-ui, sans-serif', background: '#f5fbff', border: '2px solid #1a1230', borderRadius: 14, boxShadow: '4px 4px 0 rgba(26,18,48,.35)', overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="flex-shrink-0" style={{ padding: '7px 12px', background: '#1a1230', borderBottom: '2px solid #1a1230' }}>
        <h2 className="f-display" style={{ margin: 0, fontSize: 13, letterSpacing: '.04em', color: '#c9ff2d' }}>💬 CHAT</h2>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ padding: '4px 0' }}
      >
        {messages.length === 0 ? (
          <div className="p-4 text-center">
            <p className="f-comic text-sm" style={{ color: '#2a1a55' }}>
              Welcome to the chat!
            </p>
          </div>
        ) : (
          messages.map((message) => {
            // Render poll messages differently
            if (message.kind === 'poll') {
              return (
                <div key={message.id} className="p-2">
                  <PollCard 
                    pollId={message.body} 
                    userId={userId} 
                    room={room} 
                  />
                </div>
              );
            }

            // Render system messages differently
            if (message.kind === 'system') {
              return (
                <div key={message.id} style={{ padding: '4px 10px' }}>
                  <div className="f-comic text-xs italic" style={{ color: '#a18ad4' }}>
                    {message.body}
                  </div>
                </div>
              );
            }

            // Render regular user messages (compact, inline)
            const userColor = getUsernameColor(message.user_name);
            return (
              <div key={message.id} style={{ padding: '4px 10px' }}>
                <div className="flex flex-wrap items-baseline gap-1 text-sm leading-relaxed">
                  <span
                    className="font-bold"
                    style={{ color: userColor }}
                  >
                    {message.user_name}
                  </span>
                  <span style={{ color: '#a18ad4' }}>:</span>
                  <span className="break-words" style={{ color: '#1a1230' }}>{message.body}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Scroll to bottom indicator */}
      {!autoScroll && (
        <div className="flex-shrink-0" style={{ padding: '4px 8px', borderTop: '2px solid #1a1230' }}>
          <button
            onClick={() => {
              scrollToBottom();
              setAutoScroll(true);
            }}
            className="w-full text-xs py-1 f-comic"
            style={{ color: '#2a1a55' }}
          >
            More messages below
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0" style={{ padding: 8, borderTop: '2px solid #1a1230', background: '#f0e6cf' }}>
        {error && (
          <div className="text-xs mb-1" style={{ color: '#a31616' }}>{error}</div>
        )}

        {rateLimitSeconds > 0 && (
          <div className="text-xs mb-1 f-mono" style={{ color: '#2a1a55' }}>
            Slow mode: {rateLimitSeconds}s
          </div>
        )}

        <form onSubmit={handleSend} className="flex flex-col gap-2">
          <div className="text-xs mb-1 f-mono" style={{ color: '#2a1a55' }}>
            Chatting as: <span className="font-medium">{userName}</span>
          </div>
          <input
            type="text"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="say something..."
            className="w-full text-sm"
            style={{ border: '2px solid #1a1230', borderRadius: 6, padding: '7px 10px', background: '#fff', color: '#1a1230' }}
            disabled={sending || rateLimitSeconds > 0}
            maxLength={MAX_MESSAGE_LENGTH}
          />
        </form>
      </div>
    </div>
  );
}

