'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
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
          messages.map((message) => {
            // Render poll messages differently
            if (message.kind === 'poll') {
              return (
                <div key={message.id}>
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
                <div key={message.id} className="flex justify-center">
                  <div className="bg-slate-700/50 rounded-lg px-4 py-2 max-w-md">
                    <p className="text-xs text-slate-300 text-center">
                      {message.body}
                    </p>
                  </div>
                </div>
              );
            }

            // Render regular user messages
            return (
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
            );
          })
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

