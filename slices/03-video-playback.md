# Slice 03: Video Playback

## Overview
Implement core video playback functionality using HLS.js with Mux-signed URLs, including adaptive bitrate streaming, playback controls, and error handling.

## Goals
- Integrate HLS.js video player
- Implement Mux token signing and validation
- Build video player UI with controls
- Handle token refresh automatically
- Implement error handling and recovery

## Dependencies
- **Slice 01**: Project foundation
- **Slice 02**: Authentication system (for protected routes)

## Technical Requirements

### 1. Current Stream API

**File: `app/api/current/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePlaybackToken } from '@/lib/mux';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Verify authentication
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get current stream from database
    const { data, error } = await supabaseAdmin
      .from('current_stream')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'No active stream configured' },
        { status: 404 }
      );
    }

    // Generate signed playback token
    const token = generatePlaybackToken(data.playback_id);

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      playbackId: data.playback_id,
      title: data.title,
      kind: data.kind,
      token,
      expiresAt,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching current stream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Video Player Component

**File: `components/VideoPlayer.tsx`**
```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  playbackId: string;
  token: string;
  title: string;
}

export default function VideoPlayer({ playbackId, token, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;

    // Initialize HLS.js
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hlsRef.current = hls;

      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        console.log('HLS manifest loaded');
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error. Retrying...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error. Attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setError('Fatal error occurred. Please refresh the page.');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
      });
    } else {
      setError('Your browser does not support HLS playback');
    }
  }, [playbackId, token]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  if (error) {
    return (
      <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
        <div className="text-center p-6">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group aspect-video bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        onClick={togglePlay}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading video...</p>
          </div>
        </div>
      )}

      {/* Custom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-blue-400 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-white hover:text-blue-400">
              {isMuted || volume === 0 ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quality Badge */}
          <div className="text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
            {currentQuality}
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-blue-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title Overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4">
        <h2 className="text-white font-semibold">{title}</h2>
      </div>
    </div>
  );
}
```

### 3. Token Refresh Hook

**File: `hooks/useTokenRefresh.ts`**
```typescript
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
```

### 4. Event Page with Video Player

**File: `app/event/page.tsx`**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';

interface StreamData {
  playbackId: string;
  token: string;
  expiresAt: string;
  title: string;
  kind: string;
}

export default function EventPage() {
  const router = useRouter();
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Token refresh hook
  useTokenRefresh(streamData, setStreamData);

  useEffect(() => {
    async function loadStream() {
      try {
        const response = await fetch('/api/current');

        if (response.status === 401) {
          router.push('/event/login');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load stream');
        }

        const data = await response.json();
        setStreamData(data);
      } catch (err) {
        setError('Failed to load event. Please try again.');
        console.error('Error loading stream:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStream();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !streamData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No stream available'}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">{streamData.title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
              Live
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player - 70% width on desktop */}
          <div className="lg:col-span-2">
            <VideoPlayer
              playbackId={streamData.playbackId}
              token={streamData.token}
              title={streamData.title}
            />
          </div>

          {/* Sidebar - 30% width on desktop */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4">Chat</h2>
              <p className="text-slate-400 text-sm">Chat will be available here</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### 5. Enhanced Mux Library

**Update: `lib/mux.ts`**
```typescript
import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export default mux;

export interface PlaybackTokenOptions {
  type?: 'video' | 'thumbnail' | 'storyboard';
  expiration?: string;
  params?: Record<string, any>;
}

export function generatePlaybackToken(
  playbackId: string,
  options: PlaybackTokenOptions = {}
): string {
  const {
    type = 'video',
    expiration = '1h',
    params = {},
  } = options;

  const token = Mux.JWT.signPlaybackId(playbackId, {
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
    expiration,
    type,
    params,
  });

  return token;
}

export async function getMuxAsset(assetId: string) {
  const asset = await mux.video.assets.retrieve(assetId);
  return asset;
}

export async function listMuxAssets() {
  const assets = await mux.video.assets.list({ limit: 100 });
  return assets;
}
```

## Implementation Tasks

- [ ] Create `/api/current` endpoint with Mux token signing
- [ ] Create `VideoPlayer` component with HLS.js
- [ ] Implement playback controls (play/pause, volume, fullscreen)
- [ ] Add loading and error states
- [ ] Create `useTokenRefresh` hook
- [ ] Update `/event` page to use VideoPlayer
- [ ] Add authentication check to event page
- [ ] Implement HLS.js error recovery
- [ ] Add quality display badge
- [ ] Test with Mux test video
- [ ] Test token refresh mechanism
- [ ] Test across browsers (Chrome, Firefox, Safari)

## Acceptance Criteria

✅ **Video Playback:**
- [ ] Video loads and plays smoothly
- [ ] HLS adaptive bitrate works (adjusts to bandwidth)
- [ ] Time to First Frame < 3 seconds
- [ ] Video works in Chrome, Firefox, Safari
- [ ] Mobile Safari works (native HLS)

✅ **Controls:**
- [ ] Play/pause button works
- [ ] Volume control works
- [ ] Mute/unmute works
- [ ] Fullscreen mode works
- [ ] Controls hide/show on hover
- [ ] Click on video toggles play/pause

✅ **Token Management:**
- [ ] Initial token loads correctly
- [ ] Token refresh happens automatically
- [ ] Expired token shows error message
- [ ] Token refresh doesn't interrupt playback

✅ **Error Handling:**
- [ ] Network errors show user-friendly message
- [ ] Fatal errors show retry button
- [ ] Automatic retry for recoverable errors
- [ ] Console logs helpful debug info

✅ **UI/UX:**
- [ ] Loading spinner during initial load
- [ ] Responsive design (desktop and mobile)
- [ ] Video maintains 16:9 aspect ratio
- [ ] Title displayed above video
- [ ] Quality badge shows current resolution

## Testing

**Manual Tests:**
1. **Basic Playback:**
   - Load `/event` page
   - Video should load and be ready to play
   - Click play → video starts
   - Check console for HLS logs

2. **Controls:**
   - Test play/pause
   - Adjust volume
   - Mute/unmute
   - Enter fullscreen
   - Test keyboard shortcuts (spacebar)

3. **Token Refresh:**
   - Load video
   - Wait 50+ minutes (or mock time)
   - Verify token refreshes without interruption

4. **Error Scenarios:**
   - Invalid playback ID → should show error
   - Network disconnect → should show retry
   - Expired token → should refresh automatically

5. **Cross-Browser:**
   - Test in Chrome, Firefox, Safari
   - Test on iOS Safari (mobile)
   - Test on Android Chrome

**Performance Tests:**
```bash
# Measure Time to First Frame
# Open DevTools → Network → Record
# Load /event page
# Measure time from initial load to first video frame
```

## Notes

- HLS.js v1.5+ required for latest features
- Mux tokens expire after 1 hour by default
- Token refresh at 50 minutes (10 min buffer)
- Use `dynamic = 'force-dynamic'` in API route to prevent caching
- Native HLS support in Safari means no HLS.js needed
- Consider adding Picture-in-Picture in future slice

## Troubleshooting

**Video won't load:**
- Check playback ID in database
- Verify Mux token in browser console
- Test Mux URL directly in browser
- Check CORS settings

**Playback stuttering:**
- Check network bandwidth
- Verify HLS buffer settings
- Check for CPU throttling
- Test with lower quality

**Token expired errors:**
- Verify token expiration time
- Check token refresh logic
- Ensure `/api/current` returns fresh tokens

## Next Slice

After completing video playback, proceed to **Slice 04: Stream Management** to implement admin-controlled stream switching.

