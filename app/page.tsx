'use client';

import { useEffect, useState } from 'react';
import EventCountdown from '@/components/EventCountdown';

export default function Home() {
  const [showPoster, setShowPoster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPosterMode() {
      try {
        const response = await fetch('/api/current');
        if (response.ok) {
          const data = await response.json();
          setShowPoster(data.showPoster || false);
        }
      } catch (error) {
        console.error('Failed to check poster mode:', error);
      } finally {
        setLoading(false);
      }
    }

    checkPosterMode();
  }, []);

  // Show poster mode if enabled
  if (showPoster && !loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 relative"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
        }}
      >
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center justify-center gap-8">
          {/* Retro TV Frame with Banner */}
          <div className="tv-frame max-w-4xl w-full">
            <div className="tv-screen">
              <img 
                src="/assets/images/banner.jpeg" 
                alt="Movie Marathon Schedule" 
                className="w-full h-auto"
              />
            </div>
            {/* TV Controls */}
            <div className="tv-controls">
              <div className="tv-button"></div>
              <div className="flex gap-1">
                <div className="tv-button"></div>
                <div className="tv-button"></div>
              </div>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 h-3 bg-gray-600 rounded-sm"></div>
                ))}
              </div>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-600 border border-gray-500"></div>
                <div className="w-3 h-3 rounded-full bg-gray-600 border border-gray-500"></div>
                <div className="w-2 h-2 rounded-full bg-gray-700"></div>
              </div>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="w-full max-w-2xl">
            <EventCountdown />
          </div>
        </div>
      </main>
    );
  }

  // Show normal landing page when poster mode is off
  return (
    <main className="min-h-screen text-white flex items-center justify-center p-4 relative"
      style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #3b82f6 100%)',
      }}
    >
      <div className="text-center max-w-4xl relative z-10">
        {/* Retro TV Frame with Banner */}
        <div className="tv-frame">
          <div className="tv-screen">
            <img 
              src="/assets/images/banner.jpeg" 
              alt="Movie Marathon Schedule" 
              className="w-full h-auto"
            />
          </div>
          {/* TV Controls */}
          <div className="tv-controls">
            <div className="tv-button"></div>
            <div className="flex gap-1">
              <div className="tv-button"></div>
              <div className="tv-button"></div>
            </div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1 h-3 bg-gray-600 rounded-sm"></div>
              ))}
            </div>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-600 border border-gray-500"></div>
              <div className="w-3 h-3 rounded-full bg-gray-600 border border-gray-500"></div>
              <div className="w-2 h-2 rounded-full bg-gray-700"></div>
            </div>
          </div>
        </div>

        {/* Join Button */}
        <div className="mt-8">
          <a 
            href="/event" 
            className="twitch-button text-center inline-block text-lg px-12"
          >
            Join
          </a>
        </div>
      </div>
    </main>
  );
}

