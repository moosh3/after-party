'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CHANNEL_NAMES } from '@/lib/constants';

export interface PresentViewer {
  userId: string;
  displayName: string;
  avatar: string;
}

// Real-time "who's here" via Supabase Presence — connection-based, no table
// to maintain or clean up. Shared across Home and Watch so both show the
// same live roster of currently-connected viewers.
export function useLobbyPresence(self: PresentViewer | null): PresentViewer[] {
  const [viewers, setViewers] = useState<PresentViewer[]>([]);

  useEffect(() => {
    if (!self) return undefined;

    const channel = supabase.channel(CHANNEL_NAMES.LOBBY_PRESENCE, {
      config: { presence: { key: self.userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresentViewer>();
        const present = Object.values(state)
          .map((entries) => entries[0])
          .filter((v): v is PresentViewer & { presence_ref: string } => Boolean(v));
        setViewers(present);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track(self);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self?.userId, self?.displayName, self?.avatar]);

  return viewers;
}
