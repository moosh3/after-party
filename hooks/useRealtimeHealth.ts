import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type RealtimeHealthStatus = 'healthy' | 'degraded' | 'offline';

export function useRealtimeHealth() {
  const [status, setStatus] = useState<RealtimeHealthStatus>('healthy');
  const lastHeartbeatRef = useRef<number>(Date.now());
  
  useEffect(() => {
    const channel = supabase.channel('health-check')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('healthy');
          lastHeartbeatRef.current = Date.now();
          console.log('✅ Realtime connection healthy');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('offline');
          console.error('❌ Realtime connection failed:', status);
        } else if (status === 'CLOSED') {
          setStatus('offline');
          console.warn('⚠️ Realtime connection closed');
        }
      });
    
    // Heartbeat monitor - check connection health
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastHeartbeatRef.current;
      if (elapsed > 30000) {
        setStatus('offline');
        console.error('❌ Realtime connection lost (no heartbeat for 30s)');
      } else if (elapsed > 15000) {
        setStatus('degraded');
        console.warn('⚠️ Realtime connection degraded (no heartbeat for 15s)');
      }
    }, 5000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []); // Empty dependency array - only run once on mount
  
  return status;
}

