# Realtime Connection Health Monitoring Fix

## Issue Description

Viewers were experiencing false connection health warnings:
- "⚠️ Realtime connection degraded (no heartbeat for 15s)" 
- "❌ Realtime connection lost (no heartbeat for 30s)"

These warnings appeared even though the Supabase realtime connections were working correctly. The playback sync channel would close and resubscribe repeatedly due to the health monitoring falsely detecting connection failures.

## Root Cause

The `useRealtimeHealth` hook was monitoring a "health-check" channel but had a critical flaw:
1. It created a channel and subscribed to it
2. It set the `lastHeartbeatRef` timestamp on initial subscription
3. **But the channel never received any data or events after subscription**
4. The heartbeat monitor interval would check the timestamp and see it hadn't been updated
5. After 15s, it would mark the connection as "degraded"
6. After 30s, it would mark it as "offline"

This was a false positive - the realtime connection was healthy, but the monitoring mechanism had no way to know because it wasn't listening for actual heartbeat signals.

## Solution

### 1. Use Supabase Presence for Real Heartbeats

Updated `hooks/useRealtimeHealth.ts` to:
- Configure the channel with **presence** tracking
- Listen for `presence.sync` events which fire regularly
- Track our own presence by calling `channel.track()` with a timestamp
- Send periodic presence updates every 10 seconds to generate heartbeat activity
- Update `lastHeartbeatRef` whenever we receive a presence sync event

This creates actual bi-directional communication that can be monitored for health.

### 1.5. Fix Stale Closure Bug

**Critical Fix**: The original implementation had a React stale closure bug:
- The `useEffect` had an empty dependency array `[]`
- Callbacks inside the effect referenced the `status` state variable
- These callbacks captured the initial `status` value ('healthy') and never saw updates
- The recovery logic `if (status !== 'healthy')` would always evaluate to false
- This **completely broke the connection recovery mechanism**

**Solution**: Use a ref to track current status:
```typescript
const statusRef = useRef<RealtimeHealthStatus>('healthy');

// Update ref whenever state changes
useEffect(() => {
  statusRef.current = status;
}, [status]);

// In callbacks, use statusRef.current instead of status
if (statusRef.current !== 'healthy') {
  setStatus('healthy');
  console.log('✅ Realtime connection healthy');
}
```

This ensures callbacks always see the current status value, fixing the recovery mechanism.

### 2. More Lenient Thresholds

Increased the heartbeat timeout thresholds:
- Degraded: 15s → 25s (more tolerance for network hiccups)
- Offline: 30s → 45s (prevents premature failure detection)

### 3. Track Actual Playback Updates

Updated `components/VideoPlayer.tsx` to:
- Track when the playback sync channel receives actual UPDATE events
- Update a timestamp whenever realtime data is received
- This provides a secondary health indicator based on actual data flow

## Benefits

1. **Accurate Health Monitoring**: Now reflects actual connection health
2. **No False Positives**: Eliminates spurious degraded/offline warnings
3. **Better User Experience**: Viewers don't see connection warnings when everything is working
4. **Proper Fallback**: When connection truly fails, the system correctly detects it and falls back to polling

## Technical Details

### Presence Heartbeat Mechanism

```typescript
const channel = supabase.channel('health-check', {
  config: {
    presence: {
      key: 'health-monitor'
    }
  }
})
.on('presence', { event: 'sync' }, () => {
  // This fires regularly when presence is active
  lastHeartbeatRef.current = Date.now();
})
```

The presence system automatically syncs state between clients and the server, providing natural heartbeat signals.

### Self-Tracking Pattern

```typescript
// After subscription
channel.track({ online_at: new Date().toISOString() });

// Periodic updates to maintain presence
setInterval(() => {
  if (channel.state === 'joined') {
    channel.track({ online_at: new Date().toISOString() });
  }
}, 10000);
```

This ensures there's always activity on the channel that can be monitored.

## Testing

To verify the fix works:

1. Open the viewer page in a browser
2. Check the console - you should see:
   - `✅ Realtime connection healthy` on initial load
   - `Playback sync subscription status: SUBSCRIBED` 
   - `Poster mode subscription status: SUBSCRIBED`
3. Wait 30+ seconds
4. **You should NOT see** degraded or offline warnings (unless the connection actually fails)
5. The playback sync should remain stable without closing/reopening

## Related Files Modified

- `hooks/useRealtimeHealth.ts` - Core fix for health monitoring
- `components/VideoPlayer.tsx` - Added tracking of realtime update timestamps

## Notes

The `inferred.litix.io` errors visible in the logs are from Mux analytics being blocked by ad blockers. This is expected and not related to the realtime connection issues. These can be safely ignored.

