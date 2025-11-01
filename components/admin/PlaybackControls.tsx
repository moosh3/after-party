'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface HoldScreenMuxItem {
  id: string;
  playback_id: string;
  label: string;
  kind: string;
  duration_seconds?: number;
}

export default function PlaybackControls() {
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused'>('paused');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Hold screen state
  const [holdScreenEnabled, setHoldScreenEnabled] = useState(false);
  const [holdScreenMuxItem, setHoldScreenMuxItem] = useState<HoldScreenMuxItem | null>(null);

  useEffect(() => {
    // Load current playback state
    async function loadState() {
      try {
        const response = await fetch('/api/admin/playback-control');
        if (response.ok) {
          const data = await response.json();
          setPlaybackState(data.playback_state);
        }
      } catch (err) {
        console.error('Failed to load playback state:', err);
      }
    }
    
    // Load hold screen status
    async function loadHoldScreenStatus() {
      try {
        const response = await fetch('/api/admin/hold-screen');
        if (response.ok) {
          const data = await response.json();
          setHoldScreenEnabled(data.hold_screen_enabled);
          setHoldScreenMuxItem(data.mux_item);
        }
      } catch (err) {
        console.error('Failed to load hold screen status:', err);
      }
    }
    
    loadState();
    loadHoldScreenStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('playback-control-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'current_stream',
          filter: 'id=eq.1',
        },
        (payload) => {
          const newState = payload.new as any;
          if (newState.playback_state) {
            setPlaybackState(newState.playback_state);
          }
          if (newState.hold_screen_enabled !== undefined) {
            setHoldScreenEnabled(newState.hold_screen_enabled);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handlePlaybackControl(action: 'play' | 'pause') {
    setLoading(true);
    setMessage(null);

    // ISSUE #11: Optimistic update - immediately update UI
    const previousState = playbackState;
    setPlaybackState(action === 'play' ? 'playing' : 'paused');

    try {
      const response = await fetch('/api/admin/playback-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (response.ok) {
        setPlaybackState(data.playback_state);
        setMessage({ 
          type: 'success', 
          text: `${action === 'play' ? 'Started' : 'Paused'} playback for all viewers` 
        });
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        // Revert optimistic update on error
        setPlaybackState(previousState);
        setMessage({ type: 'error', text: data.error || 'Failed to control playback' });
      }
    } catch (error) {
      // Revert optimistic update on error
      setPlaybackState(previousState);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart() {
    setLoading(true);
    setMessage(null);

    // ISSUE #11: Add optimistic update
    setPlaybackState('playing');

    try {
      // ISSUE #10: Use atomic restart action instead of separate seek + play
      const response = await fetch('/api/admin/playback-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await response.json();

      if (response.ok) {
        setPlaybackState(data.playback_state);
        setMessage({ 
          type: 'success', 
          text: 'Restarted video for all viewers' 
        });
        
        setTimeout(() => setMessage(null), 3000);
      } else {
        // Revert optimistic update on error
        setMessage({ type: 'error', text: data.error || 'Failed to restart' });
        // Reload actual state
        const stateResponse = await fetch('/api/admin/playback-control');
        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          setPlaybackState(stateData.playback_state);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
      // Revert optimistic update on error
      try {
        const stateResponse = await fetch('/api/admin/playback-control');
        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          setPlaybackState(stateData.playback_state);
        }
      } catch (e) {
        // Fallback
        setPlaybackState('paused');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleHoldScreen() {
    if (!holdScreenMuxItem && !holdScreenEnabled) {
      setMessage({ type: 'error', text: 'No hold screen configured. Set one in the library first.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const previousState = holdScreenEnabled;
    const action = holdScreenEnabled ? 'disable' : 'enable';
    
    // Optimistic update
    setHoldScreenEnabled(!holdScreenEnabled);

    try {
      const response = await fetch('/api/admin/hold-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (response.ok) {
        setHoldScreenEnabled(data.hold_screen_enabled);
        setMessage({ 
          type: 'success', 
          text: data.hold_screen_enabled 
            ? `Hold screen enabled${holdScreenMuxItem ? ` - "${holdScreenMuxItem.label}"` : ''}` 
            : 'Hold screen disabled - resumed normal playback'
        });
        
        setTimeout(() => setMessage(null), 3000);
      } else {
        // Revert optimistic update on error
        setHoldScreenEnabled(previousState);
        setMessage({ type: 'error', text: data.error || 'Failed to toggle hold screen' });
      }
    } catch (error) {
      // Revert optimistic update on error
      setHoldScreenEnabled(previousState);
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="twitch-card p-4 border-t-4 border-twitch-purple">
      <h3 className="text-lg font-semibold mb-3 text-twitch-text flex items-center gap-2">
        <div className="w-2 h-2 bg-twitch-purple rounded-full animate-pulse"></div>
        Synchronized Playback Control
      </h3>
      
      <div className="bg-twitch-hover/50 border border-twitch-border rounded-lg p-3 mb-4">
        <p className="text-xs text-twitch-text-alt mb-2">
          <strong>Watch Party Mode:</strong> All viewers watch together in real-time
        </p>
        <p className="text-xs text-twitch-text-alt">
          ✓ Everyone sees the same moment<br/>
          ✓ Automatically syncs every 10 seconds<br/>
          ✓ Viewers can only control volume
        </p>
      </div>

      {message && (
        <div className={`rounded p-3 mb-3 text-sm ${
          message.type === 'success' 
            ? 'bg-success/10 border border-success text-success' 
            : 'bg-error/10 border border-error text-error'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {/* Current State */}
        <div className="flex items-center justify-between bg-twitch-hover p-3 rounded">
          <span className="text-sm text-twitch-text">Current State:</span>
          <span className={`font-semibold text-sm px-3 py-1 rounded ${
            playbackState === 'playing' 
              ? 'bg-success/20 text-success' 
              : 'bg-twitch-gray text-twitch-text-alt'
          }`}>
            {playbackState === 'playing' ? '▶ Playing' : '⏸ Paused'}
          </span>
        </div>

        {/* Hold Screen Status */}
        {holdScreenMuxItem && (
          <div className={`flex items-center justify-between p-3 rounded border ${
            holdScreenEnabled 
              ? 'bg-yellow-500/10 border-yellow-500' 
              : 'bg-twitch-hover border-twitch-border'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-twitch-text">Hold Screen:</span>
                <span className={`font-semibold text-sm px-2 py-1 rounded ${
                  holdScreenEnabled 
                    ? 'bg-yellow-500/20 text-yellow-500' 
                    : 'bg-twitch-gray text-twitch-text-alt'
                }`}>
                  {holdScreenEnabled ? '★ Active' : 'Ready'}
                </span>
              </div>
              {holdScreenMuxItem && (
                <p className="text-xs text-twitch-text-alt mt-1 truncate">
                  {holdScreenMuxItem.label}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handlePlaybackControl('play')}
            disabled={loading || playbackState === 'playing'}
            className={`py-3 px-4 rounded font-medium text-sm transition-all min-h-[44px] ${
              playbackState === 'playing'
                ? 'bg-twitch-gray text-twitch-text-alt cursor-not-allowed'
                : 'bg-success hover:bg-green-600 text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Play</span>
            </div>
          </button>

          <button
            onClick={() => handlePlaybackControl('pause')}
            disabled={loading || playbackState === 'paused'}
            className={`py-3 px-4 rounded font-medium text-sm transition-all min-h-[44px] ${
              playbackState === 'paused'
                ? 'bg-twitch-gray text-twitch-text-alt cursor-not-allowed'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Pause</span>
            </div>
          </button>

          <button
            onClick={handleRestart}
            disabled={loading}
            className="bg-twitch-purple hover:bg-purple-700 text-white py-3 px-4 rounded font-medium text-sm transition-all min-h-[44px]"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              <span>Restart</span>
            </div>
          </button>

          <button
            onClick={handleToggleHoldScreen}
            disabled={loading || (!holdScreenMuxItem && !holdScreenEnabled)}
            className={`py-3 px-4 rounded font-medium text-sm transition-all min-h-[44px] ${
              !holdScreenMuxItem && !holdScreenEnabled
                ? 'bg-twitch-gray text-twitch-text-alt cursor-not-allowed'
                : holdScreenEnabled
                ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white border-2 border-yellow-500'
            }`}
            title={!holdScreenMuxItem && !holdScreenEnabled ? 'Set a hold screen in the library first' : holdScreenEnabled ? 'Disable hold screen' : 'Enable hold screen'}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{holdScreenEnabled ? 'Hold ON' : 'Hold Screen'}</span>
            </div>
          </button>
        </div>

        <div className="text-xs text-twitch-text-alt bg-twitch-darker p-3 rounded border border-twitch-border">
          <strong className="text-twitch-text">💡 Tip:</strong> Use Play/Pause to control all viewers at once. 
          Hit Restart to begin the video from the start for everyone. Use Hold Screen to show a designated video 
          (like intermission or technical difficulties) that loops continuously.
        </div>
      </div>
    </div>
  );
}

