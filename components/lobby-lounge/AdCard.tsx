'use client';

import { useEffect, useState } from 'react';
import { ADS } from '@/app/schedule/config';
import { LL } from './tokens';

// Just the real photos — a couple of ADS entries are still placeholder-only
// (no img supplied yet) and are skipped here rather than shown as blanks.
const AD_PHOTOS: string[] = ADS.map((ad) => ad.img).filter((src): src is string => Boolean(src));

function useAdRotation(seconds: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (AD_PHOTOS.length <= 1) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % AD_PHOTOS.length), seconds * 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return index;
}

export default function AdCard({ adSeconds = 15 }: { adSeconds?: number }) {
  const index = useAdRotation(adSeconds);
  const src = AD_PHOTOS[index];
  const [failedIndex, setFailedIndex] = useState(-1);

  if (!src || failedIndex === index) return null;

  return (
    <div
      style={{
        border: `2px solid ${LL.ink}`,
        borderRadius: 14,
        boxShadow: '4px 4px 0 rgba(26,18,48,.35)',
        overflow: 'hidden',
        background: LL.deep,
        aspectRatio: '16 / 9',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={index}
        src={src}
        alt=""
        onError={() => setFailedIndex(index)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
