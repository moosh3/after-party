'use client';

import { useState, useEffect } from 'react';

export default function EventCountdown() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isEventTime: false,
  });

  useEffect(() => {
    function calculateTimeLeft() {
      // Event date: November 1, 2025, 8:30 AM Central Time
      // Using explicit date format that works cross-browser
      const eventDate = new Date('2025-11-01T08:30:00-05:00'); // CDT (Central Daylight Time)
      const now = new Date();
      const difference = eventDate.getTime() - now.getTime();

      if (difference <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isEventTime: true,
        };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isEventTime: false,
      };
    }

    // Calculate immediately
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (timeLeft.isEventTime) {
    return (
      <div className="text-center py-8">
        <h2 
          className="text-5xl md:text-7xl font-black text-red-600 animate-pulse"
          style={{ 
            fontFamily: 'Scary, serif',
            textShadow: '0 0 30px rgba(220, 38, 38, 0.8), 0 0 60px rgba(220, 38, 38, 0.5), 3px 3px 0 #0891b2',
            WebkitTextStroke: '2px #0891b2',
            letterSpacing: '0.05em'
          }}
        >
          EVENT STARTING SOON!
        </h2>
      </div>
    );
  }

  const timeUnits = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Minutes' },
    { value: timeLeft.seconds, label: 'Seconds' },
  ];

  return (
    <div className="py-8 px-4">
      {/* Title */}
      <div className="bg-black/60 rounded-lg p-4 mb-8 backdrop-blur-sm">
        <h2 
          className="text-2xl md:text-5xl font-black text-white text-center"
          style={{ 
            fontFamily: 'Scary, serif',
            textShadow: '0 0 20px rgba(220, 38, 38, 0.8), 0 0 40px rgba(220, 38, 38, 0.6), 2px 2px 4px rgba(0, 0, 0, 0.8)',
            letterSpacing: '0.1em'
          }}
        >
          COUNTDOWN TO THE AFTER PARTY
        </h2>
      </div>

      {/* Countdown Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
        {timeUnits.map((unit, index) => (
          <div 
            key={unit.label} 
            className="flex flex-col items-center justify-center p-4 md:p-6 bg-gradient-to-br from-gray-900 to-black border-2 border-red-600 rounded-lg"
            style={{
              boxShadow: '0 0 20px rgba(220, 38, 38, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.8)'
            }}
          >
            {/* Number */}
            <div 
              className="text-5xl md:text-7xl font-black text-white mb-2"
              style={{ 
                fontFamily: 'Scary, serif',
                textShadow: '0 0 20px rgba(220, 38, 38, 0.8), 0 0 40px rgba(220, 38, 38, 0.5), 3px 3px 6px rgba(0, 0, 0, 1)',
                WebkitTextStroke: '1px rgba(220, 38, 38, 0.8)'
              }}
            >
              {String(unit.value).padStart(2, '0')}
            </div>
            
            {/* Label */}
            <div 
              className="text-sm md:text-lg font-bold uppercase tracking-wider text-cyan-400"
              style={{ 
                textShadow: '0 0 10px rgba(8, 145, 178, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.8)',
              }}
            >
              {unit.label}
            </div>
          </div>
        ))}
      </div>

      {/* Event Date */}
      <div className="bg-black/60 rounded-lg p-3 mt-6 backdrop-blur-sm">
        <p className="text-center text-white text-lg md:text-xl font-semibold" style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)' }}>
          November 1st, 2025 • 8:30 AM Central Time
        </p>
      </div>

      {/* Stream Info Button */}
      <div className="flex justify-center mt-6">
        <a 
          href="https://alecandmk.wedding/online"
          target="_blank" 
          rel="noopener noreferrer"
          className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105"
        >
          <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500 hover:border-cyan-300 rounded-lg px-8 py-4 text-center transition-all duration-300 shadow-lg hover:shadow-cyan-500/50">
            <div 
              className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide relative"
              style={{ 
                fontFamily: 'Scary, serif',
                textShadow: '2px 2px 0 #0891b2, 3px 3px 6px rgba(0, 0, 0, 0.8)',
                WebkitTextStroke: '1px #0891b2'
              }}
            >
              STREAM INFO
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

