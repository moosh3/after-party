'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const hasSubscribedRef = useRef(false);

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

  // Update local state when initialData changes (only before subscription)
  useEffect(() => {
    if (initialData) {
      setStreamData(initialData);
    }
  }, [initialData?.playbackId]); // Only depend on playbackId, not the whole object

  // Subscribe once when data is available
  useEffect(() => {
    // Don't subscribe if we already have, or if no data yet
    if (hasSubscribedRef.current || !initialData) return;

    hasSubscribedRef.current = true;

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
          
          // Always update the stream data - parent component will handle reloading
          // by using playbackId as the key prop on VideoPlayer
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
      hasSubscribedRef.current = false;
    };
  }, [initialData?.playbackId]); // Only re-subscribe if playbackId changes (actual stream change)

  // Polling interval
  useEffect(() => {
    if (!usePolling) return;

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [usePolling, poll]);

  return streamData;
}

