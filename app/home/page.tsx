'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LL_FONT_VARS } from '@/components/lobby-lounge/fonts';
import { LL } from '@/components/lobby-lounge/tokens';
import LLHeader from '@/components/lobby-lounge/LLHeader';
import FrostCard from '@/components/lobby-lounge/FrostCard';
import { LLCta } from '@/components/lobby-lounge/buttons';
import Marquee from '@/components/lobby-lounge/Marquee';
import DailyPoll from '@/components/lobby-lounge/DailyPoll';
import AdCard from '@/components/lobby-lounge/AdCard';
import MiniAvatar from '@/components/lobby-lounge/MiniAvatar';
import { useLobbyPresence } from '@/components/lobby-lounge/useLobbyPresence';
import { getViewerData, ViewerData } from '@/lib/viewer';
import '@/components/lobby-lounge/lobby-lounge.css';

// Placeholder — real Nic Cage trivia/polls to come later.
const HOME_POLL = {
  question: "Tonight's mood: which Cage era?",
  options: ['90s Action Cage', '2000s Treasure Cage', 'Arthouse Cage', 'Meme Cage'],
};

const HOME_TICKER = [
  'now entering da lobby lounge',
  'best viewed at 1024×768 · speakers up',
  '8 nic cage movies today, no notes',
  'whisper mode auto-enables after midnight',
];

function HitCounter({ count = 4231 }: { count?: number }) {
  const digits = String(count).padStart(6, '0').split('');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className="f-comic" style={{ fontSize: 12, color: LL.frost2 }}>
        you are visitor #
      </span>
      <span
        style={{
          display: 'inline-flex',
          gap: 3,
          background: '#000',
          border: `2px solid ${LL.ink}`,
          borderRadius: 4,
          padding: '3px 7px',
          boxShadow: 'inset 1px 1px 4px rgba(0,0,0,.9)',
        }}
      >
        {digits.map((d, i) => (
          <span key={i} className="f-mono" style={{ fontSize: 17, lineHeight: 1, color: LL.lime, textShadow: `0 0 5px ${LL.lime}` }}>
            {d}
          </span>
        ))}
      </span>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [viewer, setViewer] = useState<ViewerData | null>(null);
  const [nowShowingTitle, setNowShowingTitle] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Home · Da Movies';
    const data = getViewerData();
    if (!data) {
      router.replace('/login');
      return;
    }
    setViewer(data);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/current')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setNowShowingTitle(data.title || null);
      })
      .catch(() => {
        if (!cancelled) setNowShowingTitle(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const presenceSelf = viewer
    ? { userId: viewer.id, displayName: viewer.displayName, avatar: viewer.avatar }
    : null;
  const viewersHere = useLobbyPresence(presenceSelf);

  if (!viewer) return null;

  return (
    <div
      className={`dm-lobby-lounge ${LL_FONT_VARS}`}
      style={{ background: LL.ink, color: LL.frost1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <style>{`
        .ll-home-main { width: 100%; max-width: 520px; margin: 0 auto; padding: 20px 18px 26px; display: grid; gap: 16px; }
        .ll-home-cta-body { padding: 16px 18px 18px; display: grid; gap: 4px; }
        .ll-home-cta-body h2 { margin: 0; font-size: 22px; }
        .ll-home-cta-body p { margin: 0 0 10px; font-size: 13px; }
        .ll-home-cta-btn { width: 100%; justify-content: center; font-size: 16px; padding: 13px 18px; }
      `}</style>
      <a className="skip-link" href="#ll-home-main">
        Skip to content
      </a>
      <LLHeader tagline="where we like to watch movies" timestamp="JUL 4 · CHICAGO (CT)" />

      <Marquee items={HOME_TICKER} bg={LL.ink} color={LL.mint} accent={LL.lime} />

      <div
        className="f-comic"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '8px 12px 0',
          fontSize: 13,
          color: LL.frost2,
        }}
      >
        👋 logged in as <MiniAvatar avatarId={viewer.avatar} size={26} /> <strong style={{ color: LL.frost1 }}>{viewer.displayName}</strong>
      </div>

      <main id="ll-home-main" className="ll-home-main">
        <FrostCard title="● NOW SHOWING" headBg={LL.ink} headText={LL.lime}>
          <div className="ll-home-cta-body" style={{ color: LL.ink }}>
            <h2 className="f-display">{nowShowingTitle || 'tune in to find out'}</h2>
            <p className="f-comic">JOIN SCREENING to watch with the crew</p>
            <LLCta as={Link} href="/event" className="ll-home-cta-btn">
              ▶ JOIN SCREENING
            </LLCta>
          </div>
        </FrostCard>

        <FrostCard title="★ CAGE-A-THON" headBg={LL.frost3} headText={LL.frost1}>
          <div className="ll-home-cta-body" style={{ color: LL.ink }}>
            <h2 className="f-display">Full Lineup</h2>
            <p className="f-comic">8 films · 9AM – 2AM</p>
            <LLCta
              as={Link}
              href="/schedule"
              className="ll-home-cta-btn"
              style={{ background: `linear-gradient(180deg, ${LL.frost1}, ${LL.mint} 60%, #7eb9a0)` }}
            >
              SEE SCHEDULE 🗓
            </LLCta>
          </div>
        </FrostCard>

        <AdCard adSeconds={15} />

        <DailyPoll question={HOME_POLL.question} options={HOME_POLL.options} />

        <FrostCard title="★ FRIENDS CURRENTLY ENJOYING CINEMA" meta={`${viewersHere.length} here`} headBg={LL.ink} headText={LL.mint}>
          {viewersHere.length === 0 ? (
            <p className="f-comic" style={{ padding: 16, textAlign: 'center', color: LL.ink, margin: 0 }}>
              just you so far — invite the crew
            </p>
          ) : (
            <div style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {viewersHere.map((v) => (
                <div key={v.userId} style={{ display: 'grid', justifyItems: 'center', gap: 4, width: 56 }}>
                  <MiniAvatar avatarId={v.avatar} size={46} ring={LL.ink} />
                  <span className="f-mono" style={{ fontSize: 12, color: LL.ink, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.displayName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </FrostCard>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HitCounter count={4231} />
        </div>
      </main>

      <footer style={{ marginTop: 'auto', display: 'grid', gap: 6, background: LL.deep, borderTop: `3px solid ${LL.mint}` }}>
        <div
          className="f-mono"
          style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 13, color: LL.frost3, padding: '8px 18px 0' }}
        >
          <span>◄ PREV</span>
          <span>·</span>
          <span>DA MOVIES WEBRING</span>
          <span>·</span>
          <span>RANDOM ►</span>
        </div>
        <div
          style={{
            padding: '4px 18px 11px',
            color: LL.mint,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <span className="f-mono" style={{ fontSize: 14 }}>
            © 2026 damovies.watch · made by friends 4 friends
          </span>
          <span className="f-mono" style={{ fontSize: 14 }}>
            ~ shh ~ · whisper mode: on
          </span>
        </div>
      </footer>
    </div>
  );
}
