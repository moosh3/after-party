'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getViewerData } from '@/lib/viewer';
import PollCard from './PollCard';

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

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(`/api/chat/messages?room=${room}&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
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

  function getUsernameColor(name: string): string {
    // Twitch-style username colors
    const colors = [
      '#FF0000', '#0000FF', '#00FF00', '#B22222', '#FF7F50',
      '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E',
      '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F',
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-screen bg-black border-l border-twitch-border"
      style={{ fontFamily: 'Inter, Helvetica, Arial, sans-serif' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-twitch-border bg-black">
        <h2 className="text-sm font-semibold uppercase text-twitch-text">Stream Chat</h2>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        {messages.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-twitch-text-alt">
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
                <div key={message.id} className="chat-message">
                  <div className="text-xs text-twitch-text-alt italic">
                    {message.body}
                  </div>
                </div>
              );
            }

            // Render regular user messages (Twitch-style: compact, inline)
            const userColor = getUsernameColor(message.user_name);
            return (
              <div key={message.id} className="chat-message">
                <div className="flex flex-wrap items-baseline gap-1 text-sm leading-relaxed">
                  <span 
                    className="chat-username"
                    style={{ color: userColor }}
                  >
                    {message.user_name}
                  </span>
                  <span className="text-twitch-text-alt">:</span>
                  <span className="text-twitch-text break-words">{message.body}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom indicator */}
      {!autoScroll && (
        <div className="flex-shrink-0 px-2 py-1 border-t border-twitch-border">
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setAutoScroll(true);
            }}
            className="w-full text-xs text-twitch-purple hover:text-purple-400 py-1"
          >
            ↓ More messages below
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-2 border-t border-twitch-border bg-black">
        {error && (
          <div className="text-xs text-error mb-1 px-2">{error}</div>
        )}
        
        {rateLimitSeconds > 0 && (
          <div className="text-xs text-twitch-text-alt mb-1 px-2">
            Slow mode: {rateLimitSeconds}s
          </div>
        )}
        
        <form onSubmit={handleSend} className="flex flex-col gap-2">
          <div className="text-xs text-twitch-text-alt mb-1 px-2">
            Chatting as: <span className="text-twitch-text font-medium">{userName}</span>
          </div>
          <input
            type="text"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Send a message"
            className="twitch-input w-full text-sm"
            disabled={sending || rateLimitSeconds > 0}
            maxLength={600}
          />
        </form>
      </div>
    </div>
  );
}

