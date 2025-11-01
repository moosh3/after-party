'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

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
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const backoffTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const delay = useCallback((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)), []);

  const resetBackoff = useCallback(() => {
    if (backoffTimeoutRef.current) {
      clearTimeout(backoffTimeoutRef.current);
      backoffTimeoutRef.current = null;
    }
  }, []);

  const attemptRefresh = useCallback(async () => {
    if (!streamData) return;

    const expiresAt = new Date(streamData.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh at 50 minutes (10 minutes before expiry)
    const refreshThreshold = 10 * 60 * 1000;

    if (timeUntilExpiry > refreshThreshold) {
      return;
    }

    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;

    const maxAttempts = 3;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch('/api/current');
          if (response.ok) {
            const newData = await response.json();
            onRefresh(newData);
            setRefreshError(null);
            resetBackoff();
            console.log('Token refreshed successfully');
            return;
          }

          console.error('Token refresh request failed:', response.statusText);
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }

        if (attempt < maxAttempts) {
          const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
          await delay(backoffMs);
        }
      }

      setRefreshError('We are having trouble refreshing your stream access. Trying again shortly…');

      if (!backoffTimeoutRef.current) {
        backoffTimeoutRef.current = setTimeout(() => {
          backoffTimeoutRef.current = null;
          attemptRefresh();
        }, 15000);
      }
    } finally {
      isRefreshingRef.current = false;
    }
  }, [delay, onRefresh, resetBackoff, streamData]);

  const checkAndRefresh = useCallback(async () => {
    if (!streamData) return;
    await attemptRefresh();
  }, [attemptRefresh, streamData]);

  useEffect(() => {
    resetBackoff();
    setRefreshError(null);
  }, [resetBackoff, streamData?.token, streamData?.expiresAt]);

  useEffect(() => {
    // Check every 30 seconds
    const interval = setInterval(checkAndRefresh, 30 * 1000);
    return () => clearInterval(interval);
  }, [checkAndRefresh]);

  useEffect(() => {
    return () => {
      resetBackoff();
    };
  }, [resetBackoff]);

  return refreshError;
}

