'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CHANNEL_NAMES,
  DATABASE_TABLES,
} from '@/lib/constants';

interface StreamUpdate {
  playbackId: string;
  title: string;
  kind: string;
  sourceType?: string;
  updatedAt: string;
}

const STREAM_POLL_INTERVAL_MS = 3000;

function isStreamUpdatePayload(data: unknown): data is {
  playbackId: string;
  title: string;
  kind: string;
  sourceType?: string;
} {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.playbackId === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.kind === 'string'
  );
}

export function useStreamUpdates(initialData: StreamUpdate | null) {
  const [streamData, setStreamData] = useState(initialData);
  const [usePolling, setUsePolling] = useState(false);
  const hasSubscribedRef = useRef(false);

  // Polling mechanism (fallback)
  const poll = useCallback(async () => {
    try {
      const response = await fetch('/api/current', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (!isStreamUpdatePayload(data)) {
          console.warn('Ignoring invalid stream update payload:', data);
          return;
        }

        setStreamData({
          playbackId: data.playbackId,
          title: data.title,
          kind: data.kind,
          sourceType: data.sourceType,
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
    let disposed = false;

    // Try Supabase Realtime first
    const channel = supabase
      .channel(CHANNEL_NAMES.STREAM_UPDATES)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: DATABASE_TABLES.CURRENT_STREAM,
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
            sourceType: newData.source_type,
            updatedAt: newData.updated_at,
          });
        }
      )
      .subscribe((status) => {
        if (disposed) return;

        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to stream updates');
          setUsePolling(false);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.log('Realtime failed, falling back to polling');
          setUsePolling(true);
          poll();
        }
      });

    return () => {
      disposed = true;
      supabase.removeChannel(channel);
      hasSubscribedRef.current = false;
    };
  }, [initialData?.playbackId, poll]); // Only re-subscribe if playbackId changes (actual stream change)

  // Polling interval
  useEffect(() => {
    if (!usePolling) return;

    const interval = setInterval(poll, STREAM_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [usePolling, poll]);

  useEffect(() => {
    if (!usePolling) return;

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('pageshow', handleResume);
    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, [usePolling, poll]);

  return streamData;
}
