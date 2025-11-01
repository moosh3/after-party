import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export type RealtimeHealthStatus = 'healthy' | 'degraded' | 'offline';

export function useRealtimeHealth() {
  const [status, setStatus] = useState<RealtimeHealthStatus>('healthy');
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now());
  
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase.channel('health-check')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('healthy');
          setLastHeartbeat(Date.now());
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
      const elapsed = Date.now() - lastHeartbeat;
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
  }, [lastHeartbeat]);
  
  return status;
}

