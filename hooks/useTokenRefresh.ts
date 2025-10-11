'use client';

import { useEffect, useCallback } from 'react';

interface StreamData {
  playbackId: string;
  token: string;
  expiresAt: string;
  title: string;
  kind: string;
}

export function useTokenRefresh(
  streamData: StreamData | null,
  onRefresh: (newData: StreamData) => void
) {
  const checkAndRefresh = useCallback(async () => {
    if (!streamData) return;

    const expiresAt = new Date(streamData.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh at 50 minutes (10 minutes before expiry)
    const refreshThreshold = 10 * 60 * 1000;

    if (timeUntilExpiry <= refreshThreshold) {
      try {
        const response = await fetch('/api/current');
        if (response.ok) {
          const newData = await response.json();
          onRefresh(newData);
          console.log('Token refreshed successfully');
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
      }
    }
  }, [streamData, onRefresh]);

  useEffect(() => {
    // Check every 30 seconds
    const interval = setInterval(checkAndRefresh, 30 * 1000);
    return () => clearInterval(interval);
  }, [checkAndRefresh]);
}

