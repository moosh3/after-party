'use client';

import { useEffect, useState } from 'react';
import { ADS, AdEntry } from '@/app/schedule/config';
import { LL } from './tokens';

function useAdRotation(seconds: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (ADS.length <= 1) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ADS.length), seconds * 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return index;
}

function AdImage({ ad }: { ad: AdEntry }) {
  const [failed, setFailed] = useState(!ad.img);
  if (failed || !ad.img) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 90,
          border: `2px dashed ${LL.ink}`,
          borderRadius: 8,
          background: `repeating-linear-gradient(135deg, rgba(26,18,48,.1) 0 9px, transparent 9px 18px), ${LL.frost1}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 10px',
        }}
      >
        <span className="f-mono" style={{ fontSize: 15, color: LL.deep, opacity: 0.85 }}>
          {ad.imgNote || '[ drop nic cage here ]'}
        </span>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minHeight: 90, border: `2px solid ${LL.ink}`, borderRadius: 8, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.img}
        alt={ad.brand}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function AdCard({ adSeconds = 15 }: { adSeconds?: number }) {
  const index = useAdRotation(adSeconds);
  const ad = ADS[index];
  const accent = ad.accent ? LL[ad.accent] : LL.mint;

  return (
    <div
      style={{
        background: LL_FROST,
        border: `2px solid ${LL.ink}`,
        borderRadius: 14,
        boxShadow: '4px 4px 0 rgba(26,18,48,.35)',
        overflow: 'hidden',
        color: LL.ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: LL.ink,
          borderBottom: `2px solid ${LL.ink}`,
        }}
      >
        <span className="f-mono" style={{ fontSize: 15, color: LL.yellow, letterSpacing: '.06em' }}>
          ◄ PAID PROGRAMMING ►
        </span>
        <span className="f-mono" style={{ fontSize: 13, color: LL.frost3 }}>
          da movies · sponsored
        </span>
      </div>
      <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px' }}>
        <AdImage ad={ad} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              alignSelf: 'flex-start',
              fontFamily: 'var(--ll-f-vt323), monospace',
              fontSize: 15,
              background: accent,
              color: LL.ink,
              border: `1.5px solid ${LL.ink}`,
              padding: '2px 9px',
              borderRadius: 5,
              letterSpacing: '.05em',
            }}
          >
            {ad.brand}
          </span>
          <h2 className="f-shade" style={{ margin: 0, fontSize: 'clamp(20px,3vw,30px)', color: LL.ink, lineHeight: 1 }}>
            {ad.headline}
          </h2>
          {ad.say && (
            <p className="f-comic" style={{ margin: 0, fontSize: 14, color: LL.deep }}>
              {ad.say}
            </p>
          )}
          {ad.cta && (
            <button
              type="button"
              className="bevel-btn"
              style={{
                alignSelf: 'flex-start',
                fontWeight: 800,
                padding: '9px 16px',
                borderRadius: 6,
                color: LL.ink,
                background: `linear-gradient(180deg, #fff 0%, ${LL.yellow} 55%, #d4ba00 100%)`,
              }}
            >
              {ad.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const LL_FROST = `linear-gradient(160deg, ${LL.frost1} 0%, ${LL.frost2} 100%)`;
