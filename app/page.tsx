'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LL_FONT_VARS } from '@/components/lobby-lounge/fonts';
import { LL } from '@/components/lobby-lounge/tokens';
import DoorsCountdown from '@/components/lobby-lounge/DoorsCountdown';
import '@/components/lobby-lounge/lobby-lounge.css';

const POSTER = '/assets/images/ads/cage-a-thon-promo.jpg';

export default function LandingPage() {
  const router = useRouter();
  const [showPoster, setShowPoster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Da Movies';
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

  const doorsClosed = showPoster && !loading;

  return (
    <div
      className={`dm-lobby-lounge ${LL_FONT_VARS}`}
      style={{ background: LL.ink, color: LL.frost1, minHeight: '100vh' }}
    >
      <style>{`
        .ll-landing-bg {
          background-image: linear-gradient(180deg, rgba(26,18,48,.05) 0%, rgba(26,18,48,.35) 55%, ${LL.ink} 96%), url(${POSTER});
          background-size: cover;
          background-position: center 70%;
          background-repeat: no-repeat;
        }
        @media (max-width: 480px) {
          .ll-landing-bg {
            background-size: contain;
            background-position: top center;
          }
        }
      `}</style>
      <a className="skip-link" href="#ll-landing-main">
        Skip to content
      </a>
      <main
        id="ll-landing-main"
        className="ll-landing-bg"
        style={{
          position: 'relative',
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: 'min(8vh, 56px) 20px',
        }}
      >
        {doorsClosed ? (
          <DoorsCountdown />
        ) : (
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="bevel-btn f-display"
            style={{
              fontSize: 'clamp(16px, 3vw, 22px)',
              padding: '16px 34px',
              borderRadius: 10,
              background: `linear-gradient(180deg, ${LL.frost1} 0%, ${LL.lime} 55%, #95cc1f 100%)`,
              color: LL.ink,
            }}
          >
            I LIKE MOVIES ▶
          </button>
        )}
      </main>
    </div>
  );
}
