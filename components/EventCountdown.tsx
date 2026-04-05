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
      // Event date: January 28, 2026, 1:30 PM Central Time (first movie starts at 1:30 PM)
      const eventDate = new Date('2026-01-28T13:30:00-06:00'); // CST (Central Standard Time)
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
      <div className="text-center py-6">
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 inline-block shadow-casual">
          <h2 className="text-3xl md:text-5xl font-bold text-casual-dark animate-pulse">
            Streaming Now!
          </h2>
          <p className="text-casual-dark/80 mt-2 text-lg">Join the movie marathon</p>
        </div>
      </div>
    );
  }

  const timeUnits = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Mins' },
    { value: timeLeft.seconds, label: 'Secs' },
  ];

  return (
    <div className="py-4 px-4">
      {/* Title */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 mb-6 shadow-casual">
        <h2 className="text-xl md:text-3xl font-bold text-casual-dark text-center">
          Countdown to Movie Marathon
        </h2>
      </div>

      {/* Countdown Grid */}
      <div className="grid grid-cols-4 gap-2 md:gap-4 max-w-lg mx-auto">
        {timeUnits.map((unit) => (
          <div 
            key={unit.label} 
            className="flex flex-col items-center justify-center p-3 md:p-4 bg-white/70 backdrop-blur-md border-2 border-casual-pink/50 rounded-xl transition-all hover:border-casual-pink hover:bg-white/80 shadow-casual"
          >
            {/* Number */}
            <div className="text-3xl md:text-5xl font-bold text-casual-dark">
              {String(unit.value).padStart(2, '0')}
            </div>
            
            {/* Label */}
            <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-casual-dark/70">
              {unit.label}
            </div>
          </div>
        ))}
      </div>

      {/* Event Date */}
      <div className="bg-casual-violet/50 backdrop-blur-md rounded-xl p-3 mt-4 shadow-casual">
        <p className="text-center text-casual-dark text-sm md:text-base font-medium">
          January 28th, 2026 - All times in Central (Chicago) Time
        </p>
      </div>

      {/* Schedule Preview */}
      <div className="mt-4 bg-white/60 backdrop-blur-md rounded-xl p-4 shadow-casual">
        <h3 className="text-casual-dark font-bold text-center mb-3">Schedule</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-casual-dark">
            <span className="text-casual-dark font-semibold">1:30 PM</span>
            <span>Annie (1997)</span>
          </div>
          <div className="flex justify-between text-casual-dark">
            <span className="text-casual-dark font-semibold">5:00 PM</span>
            <span>Toy Story 2 (1999)</span>
          </div>
          <div className="flex justify-between text-casual-dark">
            <span className="text-casual-dark font-semibold">7:00 PM</span>
            <span>Anastasia (1997)</span>
          </div>
          <div className="flex justify-between text-casual-dark">
            <span className="text-casual-dark font-semibold">9:00 PM</span>
            <span>Anastasia: Her True Story</span>
          </div>
        </div>
      </div>
    </div>
  );
}

