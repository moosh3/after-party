'use client';

import { useEffect, useState } from 'react';
import { LL } from './tokens';

// Countdown to the Cage-A-Thon start. Shown when the operator has the
// "doors aren't open yet" (poster) mode on, in place of the join button.
const EVENT_START = '2026-07-04T09:00:00-05:00'; // 9:00 AM Chicago (CT)

function getTimeLeft() {
  const diff = new Date(EVENT_START).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function DoorsCountdown() {
  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof getTimeLeft>>(null);

  useEffect(() => {
    setTimeLeft(getTimeLeft());
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timeLeft) {
    return (
      <span className="lock-badge" style={{ background: LL.mint, color: LL.ink, border: `1.5px solid ${LL.ink}`, fontSize: 14, padding: '8px 16px' }}>
        🎬 IT&apos;S TIME — check back in a sec
      </span>
    );
  }

  const units: [number, string][] = [
    [timeLeft.days, 'days'],
    [timeLeft.hours, 'hrs'],
    [timeLeft.minutes, 'min'],
    [timeLeft.seconds, 'sec'],
  ];

  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      <span className="lock-badge" style={{ background: LL.mint, color: LL.ink, border: `1.5px solid ${LL.ink}` }}>
        🔒 DOORS OPEN JUL 4 · 9:00 AM CT
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {units.map(([value, label]) => (
          <div
            key={label}
            style={{
              background: LL.deep,
              border: `2px solid ${LL.ink}`,
              borderRadius: 8,
              padding: '8px 12px',
              minWidth: 56,
              textAlign: 'center',
              boxShadow: '2px 2px 0 rgba(0,0,0,.4)',
            }}
          >
            <div className="f-mono" style={{ fontSize: 26, color: LL.lime, lineHeight: 1 }}>
              {String(value).padStart(2, '0')}
            </div>
            <div className="f-comic" style={{ fontSize: 11, color: LL.frost2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
