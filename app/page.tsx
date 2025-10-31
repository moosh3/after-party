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
      <main 
        className="min-h-screen bg-twitch-darker flex flex-col items-center justify-center p-4"
        style={{
          backgroundImage: 'url(/assets/backgrounds/background_.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto'
        }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
          {/* Event Poster */}
          <div className="flex justify-center animate-fade-in flex-shrink-0">
            <img 
              src="/assets/images/event-poster.png" 
              alt="After Party Movie Marathon" 
              className="w-full max-w-xs md:max-w-md h-auto rounded-lg shadow-2xl"
              style={{
                boxShadow: '0 0 50px rgba(220, 38, 38, 0.5), 0 0 100px rgba(8, 145, 178, 0.3)',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          </div>
          
          {/* Countdown Timer */}
          <div className="w-full md:flex-1">
            <EventCountdown />
          </div>
        </div>
      </main>
    );
  }

  // Show normal landing page when poster mode is off
  return (
    <main 
      className="min-h-screen bg-twitch-darker text-twitch-text flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/assets/backgrounds/background_.png)',
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto'
      }}
    >
      {/* Dark overlay for better text contrast */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      
      <div className="text-center max-w-2xl relative z-10">
        <div className="bg-black/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl border-2 border-twitch-purple/30">
          <div className="mb-8">
            <img 
              src="/assets/logos/alecmklogo.png" 
              alt="After Party Logo" 
              className="h-24 w-24 rounded-full object-cover mx-auto mb-6 shadow-2xl ring-4 ring-twitch-purple"
            />
            <h1 className="text-5xl font-bold mb-3 text-white drop-shadow-lg">After Party</h1>
            <p className="text-white text-lg font-medium">Live streaming event platform</p>
          </div>
          
          <div className="bg-twitch-dark/90 rounded-xl p-8 border border-twitch-purple/20">
            <h2 className="text-2xl font-semibold mb-4 text-white">Welcome!</h2>
            <p className="text-gray-200 mb-6 text-base leading-relaxed">
              Join our exclusive movie marathon streaming event. Watch together, chat with friends, and participate in polls!
            </p>
            <a 
              href="/event" 
              className="twitch-button text-center text-white font-bold py-3 px-6 inline-block"
            >
              Join Stream
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

