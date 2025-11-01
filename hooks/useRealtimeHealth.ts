import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type RealtimeHealthStatus = 'healthy' | 'degraded' | 'offline';

export function useRealtimeHealth() {
  const [status, setStatus] = useState<RealtimeHealthStatus>('healthy');
  const lastHeartbeatRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track current status in a ref to avoid stale closures
  const statusRef = useRef<RealtimeHealthStatus>('healthy');
  
  // Update ref whenever state changes
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  useEffect(() => {
    // Use presence to get actual heartbeat messages from Supabase
    const channel = supabase.channel('health-check', {
      config: {
        presence: {
          key: 'health-monitor'
        }
      }
    })
    .on('presence', { event: 'sync' }, () => {
      // Update heartbeat on any presence sync
      lastHeartbeatRef.current = Date.now();
      // Use ref to get current status (avoid stale closure)
      if (statusRef.current !== 'healthy') {
        setStatus('healthy');
        console.log('✅ Realtime connection healthy');
      }
    })
    .subscribe((subscriptionStatus) => {
      if (subscriptionStatus === 'SUBSCRIBED') {
        setStatus('healthy');
        lastHeartbeatRef.current = Date.now();
        console.log('✅ Realtime connection healthy');
        
        // Track our own presence to generate heartbeats
        channel.track({ online_at: new Date().toISOString() });
      } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
        setStatus('offline');
        console.error('❌ Realtime connection failed:', subscriptionStatus);
      } else if (subscriptionStatus === 'CLOSED') {
        setStatus('offline');
        console.warn('⚠️ Realtime connection closed');
      }
    });
    
    // Send periodic presence updates to generate heartbeat activity
    const presenceInterval = setInterval(() => {
      if (channel.state === 'joined') {
        channel.track({ online_at: new Date().toISOString() });
      }
    }, 10000); // Update presence every 10 seconds
    
    // Heartbeat monitor - check connection health
    heartbeatIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastHeartbeatRef.current;
      if (elapsed > 45000) { // Increased from 30s to 45s
        setStatus('offline');
        console.error('❌ Realtime connection lost (no heartbeat for 45s)');
      } else if (elapsed > 25000) { // Increased from 15s to 25s
        setStatus('degraded');
        console.warn('⚠️ Realtime connection degraded (no heartbeat for 25s)');
      } else if (statusRef.current !== 'healthy') {
        // Connection recovered - use ref to get current status (avoid stale closure)
        setStatus('healthy');
        console.log('✅ Realtime connection recovered');
      }
    }, 5000);
    
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      clearInterval(presenceInterval);
      supabase.removeChannel(channel);
    };
  }, []); // Empty dependency array - only run once on mount
  
  return status;
}

