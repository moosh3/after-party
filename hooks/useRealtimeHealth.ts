import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CHANNEL_NAMES, REALTIME_CONFIG } from '@/lib/constants';

export type RealtimeHealthStatus = 'healthy' | 'degraded' | 'offline';

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const BASE_HEARTBEAT_INTERVAL = REALTIME_CONFIG.HEARTBEAT_CHECK_INTERVAL_MS;
const DEGRADED_THRESHOLD_MS = REALTIME_CONFIG.DEGRADED_THRESHOLD_MS;
const OFFLINE_THRESHOLD_MS = REALTIME_CONFIG.OFFLINE_THRESHOLD_MS;
const PRESENCE_UPDATE_INTERVAL = REALTIME_CONFIG.PRESENCE_UPDATE_INTERVAL_MS;

interface UseRealtimeHealthOptions {
  onStatusChange?: (status: RealtimeHealthStatus) => void;
  enabled?: boolean;
}

export function useRealtimeHealth(options: UseRealtimeHealthOptions = {}) {
  const { onStatusChange, enabled = true } = options;
  const [status, setStatus] = useState<RealtimeHealthStatus>('healthy');
  const lastHeartbeatRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribeRef = useRef<(() => void) | null>(null);
  const statusRef = useRef<RealtimeHealthStatus>('healthy');
  const channelJoinedRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);

  const updateStatus = useCallback((newStatus: RealtimeHealthStatus) => {
    if (isUnmountedRef.current || statusRef.current === newStatus) return;
    statusRef.current = newStatus;
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const calculateBackoffDelay = useCallback((attempt: number): number => {
    const exponentialDelay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY
    );
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return exponentialDelay + jitter;
  }, []);

  const cleanupChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelJoinedRef.current = false;
  }, []);

  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    cleanupChannel();
  }, [cleanupChannel]);

  const scheduleReconnect = useCallback(() => {
    if (isUnmountedRef.current || !enabled || reconnectTimeoutRef.current) return;

    const delay = calculateBackoffDelay(reconnectAttemptRef.current);
    reconnectAttemptRef.current++;

    console.log(`Scheduling reconnect attempt ${reconnectAttemptRef.current} in ${Math.round(delay)}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (!isUnmountedRef.current && enabled) {
        subscribeRef.current?.();
      }
    }, delay);
  }, [enabled, calculateBackoffDelay]);

  const markChannelInterrupted = useCallback((reason: string) => {
    channelJoinedRef.current = false;

    // Mobile websocket callbacks can flap while Mux keeps playing from buffer.
    // Only call it offline after the heartbeat has been stale long enough.
    const elapsed = Date.now() - lastHeartbeatRef.current;
    if (elapsed > OFFLINE_THRESHOLD_MS) {
      updateStatus('offline');
    } else {
      updateStatus('degraded');
    }

    console.warn('Realtime connection interrupted:', reason);
    scheduleReconnect();
  }, [scheduleReconnect, updateStatus]);

  const subscribe = useCallback(() => {
    if (isUnmountedRef.current || !enabled) return;

    cleanupChannel();

    const channel = supabase.channel(CHANNEL_NAMES.HEALTH_CHECK, {
      config: {
        presence: {
          key: REALTIME_CONFIG.PRESENCE_KEY_HEALTH
        }
      }
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        if (channelRef.current !== channel) return;

        channelJoinedRef.current = true;
        lastHeartbeatRef.current = Date.now();
        if (statusRef.current !== 'healthy') {
          updateStatus('healthy');
          reconnectAttemptRef.current = 0;
          console.log('Realtime connection recovered');
        }
      })
      .subscribe((subscriptionStatus) => {
        if (channelRef.current !== channel) return;
        if (isUnmountedRef.current) return;

        if (subscriptionStatus === 'SUBSCRIBED') {
          channelJoinedRef.current = true;
          lastHeartbeatRef.current = Date.now();
          reconnectAttemptRef.current = 0;
          updateStatus('healthy');
          console.log('Realtime connection healthy');
          channel.track({ online_at: new Date().toISOString() });
        } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          markChannelInterrupted(subscriptionStatus);
        } else if (subscriptionStatus === 'CLOSED') {
          markChannelInterrupted(subscriptionStatus);
        }
      });

  }, [enabled, cleanupChannel, updateStatus, markChannelInterrupted]);

  subscribeRef.current = subscribe;

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    isUnmountedRef.current = false;
    subscribe();

    const presenceInterval = setInterval(() => {
      if (channelRef.current?.state === 'joined') {
        channelRef.current.track({ online_at: new Date().toISOString() });
      }
    }, PRESENCE_UPDATE_INTERVAL);

    heartbeatIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastHeartbeatRef.current;
      if (channelRef.current?.state === 'joined') {
        channelJoinedRef.current = true;
      }

      if (elapsed > OFFLINE_THRESHOLD_MS) {
        if (statusRef.current !== 'offline') {
          updateStatus('offline');
          scheduleReconnect();
        }
      } else if (elapsed > DEGRADED_THRESHOLD_MS || !channelJoinedRef.current) {
        if (statusRef.current !== 'degraded') {
          updateStatus('degraded');
        }
      } else if (statusRef.current !== 'healthy') {
        updateStatus('healthy');
      }
    }, BASE_HEARTBEAT_INTERVAL);

    return () => {
      isUnmountedRef.current = true;
      cleanup();
      clearInterval(presenceInterval);
    };
  }, [enabled, subscribe, cleanup, updateStatus, scheduleReconnect]);

  return status;
}
