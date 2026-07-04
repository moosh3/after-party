'use client';

import { useEffect, useRef, useState } from 'react';
import MiniAvatar from './MiniAvatar';
import { LL } from './tokens';
import type { PresentViewer } from './useLobbyPresence';

const PHRASES = [
  'grabbed a seat',
  'slid into the room',
  'snuck in',
  'just walked in',
];

const TOAST_MS = 4000;
// Presence flaps when a phone sleeps and the websocket reconnects — don't
// re-announce someone unless they've been gone a while.
const REJOIN_COOLDOWN_MS = 3 * 60 * 1000;
// Presence entries trickle in over the first sync(s) after we join; those are
// people who were already here, not arrivals.
const INITIAL_SYNC_GRACE_MS = 8000;
const MAX_TOASTS = 3;

interface Toast {
  key: number;
  name: string;
  avatar: string;
  phrase: string;
}

export default function PresenceToasts({
  viewers,
  selfId,
}: {
  viewers: PresentViewer[];
  selfId: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const mountedAtRef = useRef<number>(Date.now());
  const keyRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    const withinGrace = now - mountedAtRef.current < INITIAL_SYNC_GRACE_MS;
    const lastSeen = lastSeenRef.current;

    for (const viewer of viewers) {
      const last = lastSeen.get(viewer.userId);
      lastSeen.set(viewer.userId, now);

      if (withinGrace || viewer.userId === selfId) continue;
      if (last !== undefined && now - last < REJOIN_COOLDOWN_MS) continue;

      const key = ++keyRef.current;
      const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
      setToasts((prev) => [
        ...prev.slice(-(MAX_TOASTS - 1)),
        { key, name: viewer.displayName, avatar: viewer.avatar, phrase },
      ]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== key));
      }, TOAST_MS);
    }
  }, [viewers, selfId]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 10,
        display: 'grid',
        gap: 6,
        justifyItems: 'start',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.key}
          className="ll-toast f-comic"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px 3px 4px',
            borderRadius: 999,
            background: 'rgba(26,18,48,.85)',
            border: `1.5px solid ${LL.mint}`,
            fontSize: 12,
            backdropFilter: 'blur(2px)',
          }}
        >
          <MiniAvatar avatarId={toast.avatar} size={20} ring={LL.mint} />
          <span>
            <strong style={{ color: LL.frost1 }}>{toast.name}</strong>{' '}
            <span style={{ color: LL.frost2 }}>{toast.phrase}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
