'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bungee, Bungee_Shade, VT323, Comic_Neue, Outfit } from 'next/font/google';
import './schedule.css';
import {
  ADS,
  AdEntry,
  SCHEDULE,
  ScheduleEntry,
  ScheduleLayout,
  SETTINGS,
  TWEAKS_DEFAULTS,
  TWEAKS_STORAGE_KEY,
  ScheduleTweaks,
} from './config';

const bungee = Bungee({ subsets: ['latin'], weight: '400', variable: '--f-bungee' });
const bungeeShade = Bungee_Shade({ subsets: ['latin'], weight: '400', variable: '--f-bungee-shade' });
const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--f-vt323' });
const comicNeue = Comic_Neue({ subsets: ['latin'], weight: ['400', '700'], variable: '--f-comic-neue' });
const outfit = Outfit({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--f-outfit' });

const FONT_VARS = [bungee.variable, bungeeShade.variable, vt323.variable, comicNeue.variable, outfit.variable].join(
  ' '
);

const CYCLE: NonNullable<ScheduleEntry['accent']>[] = ['frost2', 'mint', 'lime', 'yellow', 'cream', 'frost3'];

function parseClock(str: string): number {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(str.trim());
  if (!m) return 0;
  let h = (+m[1]) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + +m[2];
}

interface ProgramSpan {
  startM: number;
  endM: number;
}

function programSpans(schedule: ScheduleEntry[]): ProgramSpan[] {
  let dayOff = 0;
  let prev = -1;
  return schedule.map((s) => {
    const st = parseClock(s.start);
    // a slot starting earlier than the previous one means the schedule rolled past midnight
    if (st < prev) dayOff += 1440;
    prev = st;
    const en = parseClock(s.end);
    return { startM: st + dayOff, endM: en + dayOff + (en < st ? 1440 : 0) };
  });
}

function eventNowMin(eventDate: string, timezone: string): number | null {
  if (!eventDate) return null;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || undefined,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value])
    );
    const hh = (+parts.hour) % 24;
    const mm = +parts.minute;
    const today = Date.parse(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    const ev = Date.parse(`${eventDate}T00:00:00Z`);
    if (Number.isNaN(today) || Number.isNaN(ev)) return null;
    const dayDiff = Math.round((today - ev) / 86400000);
    return dayDiff * 1440 + hh * 60 + mm;
  } catch {
    return null;
  }
}

type RowStatus = 'past' | 'live' | 'upcoming';
type MarathonState = 'before' | 'running' | 'over' | 'unknown';

interface StatusInfo {
  st: RowStatus[];
  state: MarathonState;
  liveIdx: number;
}

function computeStatus(schedule: ScheduleEntry[], eventDate: string, timezone: string): StatusInfo {
  const spans = programSpans(schedule);
  const now = eventNowMin(eventDate, timezone);
  const first = spans[0]?.startM ?? 0;
  const last = spans[spans.length - 1]?.endM ?? 0;
  const st: RowStatus[] = spans.map((sp) =>
    now == null ? 'upcoming' : now >= sp.endM ? 'past' : now >= sp.startM ? 'live' : 'upcoming'
  );
  let state: MarathonState = 'unknown';
  if (now != null) state = now < first ? 'before' : now >= last ? 'over' : 'running';
  return { st, state, liveIdx: st.indexOf('live') };
}

function loadTweaks(): ScheduleTweaks {
  try {
    const raw = window.localStorage.getItem(TWEAKS_STORAGE_KEY);
    if (!raw) return TWEAKS_DEFAULTS;
    return { ...TWEAKS_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return TWEAKS_DEFAULTS;
  }
}

function ReelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="var(--ink)" stroke="var(--mint)" strokeWidth={3} />
      <circle cx="32" cy="32" r="8" fill="var(--frost1)" stroke="var(--ink)" strokeWidth={2} />
      <circle cx="32" cy="13" r="4" fill="var(--yellow)" />
      <circle cx="48" cy="23" r="4" fill="var(--yellow)" />
      <circle cx="48" cy="41" r="4" fill="var(--yellow)" />
      <circle cx="32" cy="51" r="4" fill="var(--yellow)" />
      <circle cx="16" cy="41" r="4" fill="var(--yellow)" />
      <circle cx="16" cy="23" r="4" fill="var(--yellow)" />
    </svg>
  );
}

function stillFallback(title: string): string {
  const m = /\((\d{4})\)/.exec(title);
  return m ? m[1] : '▶';
}

function Thumb({ entry }: { entry: ScheduleEntry }) {
  const [failed, setFailed] = useState(!entry.still);
  if (failed || !entry.still) {
    return (
      <div className="thumb ph">
        <span className="thumb-note">{stillFallback(entry.title)}</span>
      </div>
    );
  }
  return (
    <div className="thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${SETTINGS.stillsDir}/${entry.still}`} alt={entry.title} onError={() => setFailed(true)} />
    </div>
  );
}

function Row({ entry, index, status }: { entry: ScheduleEntry; index: number; status: RowStatus }) {
  const accent = entry.accent || CYCLE[index % CYCLE.length];
  return (
    <div
      className={`row${status === 'live' ? ' live' : ''}${status === 'past' ? ' past' : ''}`}
      style={{ '--accent': `var(--${accent})` } as React.CSSProperties}
    >
      <div className="time">
        <div className="t1">{entry.start}</div>
        <div className="t2">{`→ ${entry.end}`}</div>
      </div>
      <Thumb entry={entry} />
      <div className="mid">
        <h3>{entry.title}</h3>
        {entry.blurb && <p>{entry.blurb}</p>}
      </div>
      <div className="meta">
        <span className="onnow">
          <span className="dot" />
          ON NOW
        </span>
        {entry.rating && <span className="rating">{entry.rating}</span>}
        {entry.runtime && <span className="runtime">{entry.runtime}</span>}
      </div>
    </div>
  );
}

function Listings({ statusInfo, scrollSpeed }: { statusInfo: StatusInfo; scrollSpeed: number }) {
  return (
    <RollingTrack scrollSpeed={scrollSpeed}>
      {[0, 1].map((pass) =>
        SCHEDULE.map((entry, i) => <Row key={`${pass}-${i}`} entry={entry} index={i} status={statusInfo.st[i]} />)
      )}
    </RollingTrack>
  );
}

function RollingTrack({ scrollSpeed, children }: { scrollSpeed: number; children: React.ReactNode }) {
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wrap || !track) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let y = 0;
    let last = performance.now();
    let paused = false;
    let half = 0;
    let frame = 0;

    const measure = () => {
      half = track.scrollHeight / 2;
    };
    measure();
    const remeasure = window.setTimeout(measure, 400); // re-measure after fonts finish loading

    const onEnter = () => {
      paused = true;
    };
    const onLeave = () => {
      paused = false;
    };
    wrap.addEventListener('mouseenter', onEnter);
    wrap.addEventListener('mouseleave', onLeave);

    function step(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      if (!paused && half > 0) {
        y -= scrollSpeed * dt;
        if (-y >= half) y += half;
        track!.style.transform = `translateY(${y}px)`;
      }
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(remeasure);
      wrap.removeEventListener('mouseenter', onEnter);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, [wrap, track, scrollSpeed]);

  return (
    <div className="roll-wrap" ref={setWrap}>
      <div className="roll-track" ref={setTrack}>
        {children}
      </div>
    </div>
  );
}

function useAdRotation(adSeconds: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (ADS.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ADS.length);
    }, adSeconds * 1000);
    return () => window.clearInterval(id);
  }, [adSeconds]);
  return index;
}

function AdImage({ ad }: { ad: AdEntry }) {
  const [failed, setFailed] = useState(!ad.img);
  if (failed || !ad.img) {
    return (
      <div className="ad-img ph">
        <span className="ad-imgnote">{ad.imgNote || '[ drop nic cage here ]'}</span>
      </div>
    );
  }
  return (
    <div className="ad-img">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.img} alt={ad.brand} onError={() => setFailed(true)} />
    </div>
  );
}

function AdCard({ adSeconds }: { adSeconds: number }) {
  const index = useAdRotation(adSeconds);
  const ad = ADS[index];
  const accent = ad.accent ? `var(--${ad.accent})` : 'var(--mint)';
  return (
    <div className="ad">
      <div className="ad-head">
        <span className="kick">◄ PAID PROGRAMMING ►</span>
        <span className="paid">da movies · sponsored</span>
      </div>
      <div className="ad-body ad-fade" key={index}>
        <AdImage ad={ad} />
        <div className="ad-txt">
          <span className="brand" style={{ '--accent': accent } as React.CSSProperties}>
            {ad.brand}
          </span>
          <h2>{ad.headline}</h2>
          {ad.say && <p className="say">{ad.say}</p>}
          {ad.cta && (
            <button type="button" className="bevel">
              {ad.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AdStrip({ adSeconds }: { adSeconds: number }) {
  const index = useAdRotation(adSeconds);
  const ad = ADS[index];
  const accent = ad.accent ? `var(--${ad.accent})` : 'var(--mint)';
  return (
    <div className="adstrip">
      <span
        className="brand"
        style={{
          fontFamily: 'var(--f-vt323), monospace',
          fontSize: 15,
          background: accent,
          color: 'var(--ink)',
          border: '1.5px solid var(--ink)',
          padding: '2px 9px',
          borderRadius: 5,
          letterSpacing: '.05em',
        }}
      >
        {ad.brand}
      </span>
      <h2>{ad.headline}</h2>
      <span className="say">{ad.say || ''}</span>
      <button type="button" className="bevel">
        {ad.cta || 'CALL NOW'}
      </button>
    </div>
  );
}

function ChannelCard() {
  if (SETTINGS.marathonArt) {
    return (
      <div className="art-panel contain rail-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SETTINGS.marathonArt} alt={`${SETTINGS.channel} marathon art`} />
      </div>
    );
  }
  return (
    <div className="ch-card">
      <ReelIcon />
      <div>
        <div className="big">{SETTINGS.channel}</div>
        <div className="small">{`${SETTINGS.date} · ${SETTINGS.stamp}`}</div>
      </div>
    </div>
  );
}

function PromoScreen() {
  if (SETTINGS.marathonArt) {
    return (
      <div className="promo art-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SETTINGS.marathonArt} alt={`${SETTINGS.channel} marathon art`} />
      </div>
    );
  }
  const upNext = SCHEDULE[0];
  return (
    <div
      className="promo"
      style={{
        background:
          'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 10px, transparent 10px 20px), var(--deep)',
        border: '2px solid var(--mint)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--frost2)',
      }}
    >
      <ReelIcon />
      <div className="f-display" style={{ fontSize: 18, color: 'var(--lime)', textShadow: '2px 2px 0 var(--ink)' }}>
        UP NEXT
      </div>
      <div className="f-comic" style={{ fontSize: 14, textAlign: 'center', maxWidth: '80%' }}>
        {`${upNext.title} · ${upNext.start}`}
      </div>
    </div>
  );
}

function Ticker() {
  const items = [...SETTINGS.ticker, ...SETTINGS.ticker];
  return (
    <div className="ticker">
      <div className="ticker-track">
        {items.map((txt, i) => {
          const star = txt.startsWith('*');
          const label = star ? txt.slice(1) : txt;
          return (
            <span key={i} className={star ? 'star' : undefined}>
              {(star ? '★ ' : '◆ ') + label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function NowBar({ statusInfo }: { statusInfo: StatusInfo }) {
  const tz = SETTINGS.tzLabel ? ` ${SETTINGS.tzLabel}` : '';
  let content: React.ReactNode;
  if (statusInfo.state === 'over') {
    content = (
      <>
        THAT&apos;S A WRAP — <b>see you at the next marathon</b>
      </>
    );
  } else if (statusInfo.state === 'before') {
    const s = SCHEDULE[0];
    content = (
      <>
        STARTS {s.start}
        {tz} — <b>{s.title}</b>
      </>
    );
  } else if (statusInfo.liveIdx >= 0) {
    const s = SCHEDULE[statusInfo.liveIdx];
    content = (
      <>
        NOW: <b>{s.title}</b> ({s.start}–{s.end})
      </>
    );
  } else {
    content = `${SCHEDULE.length} listings${SETTINGS.tzLabel ? ` · all times ${SETTINGS.tzLabel}` : ''}`;
  }
  return (
    <div className="nowbar f-comic">
      <span>{SETTINGS.date}</span>
      <span className="sep">·</span>
      <span aria-live="polite">{content}</span>
    </div>
  );
}

function Footer() {
  return (
    <footer className="rs-foot">
      <span>{SETTINGS.footerLeft}</span>
      <span>{SETTINGS.footerRight}</span>
    </footer>
  );
}

function Header({
  tagline,
  onSwitchView,
  onToggleTweaks,
}: {
  tagline: string;
  onSwitchView: () => void;
  onToggleTweaks: () => void;
}) {
  return (
    <header className="rs-head">
      <div className="chrome" />
      <div className="rs-brand">
        <ReelIcon />
        <div>
          <h1 className="f-shade">{SETTINGS.brandLine}</h1>
          <p className="f-comic">{`~ ${tagline} ~`}</p>
        </div>
      </div>
      <div className="rs-head-right">
        <div className="rs-cta-row">
          <Link className="switch-btn" href={SETTINGS.homeHref}>
            🏠 HOME
          </Link>
          <Link className="join-btn" href={SETTINGS.joinUrl}>
            JOIN SCREENING ▶
          </Link>
        </div>
        <div className="hr-row">
          <button type="button" className="switch-btn" onClick={onSwitchView}>
            ⇄ SWITCH VIEW
          </button>
          <button type="button" className="switch-btn" onClick={onToggleTweaks}>
            ⚙ TWEAKS
          </button>
          <span className="ch-badge">{`● ${SETTINGS.channel}`}</span>
        </div>
        <span className="stamp f-mono">{SETTINGS.stamp}</span>
      </div>
    </header>
  );
}

function TweaksPanel({
  tweaks,
  onChange,
  onClose,
}: {
  tweaks: ScheduleTweaks;
  onChange: (patch: Partial<ScheduleTweaks>) => void;
  onClose: () => void;
}) {
  const layouts: [ScheduleLayout, string][] = [
    ['classic', 'Classic'],
    ['sidebar', 'Sidebar'],
    ['fullroll', 'Full roll'],
  ];
  return (
    <div className="tw">
      <div className="tw-head">
        <span className="f-display">TWEAKS</span>
        <button type="button" className="tw-x" aria-label="close tweaks panel" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="tw-body">
        <label className="tw-lbl">Layout</label>
        <div className="tw-seg">
          {layouts.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={tweaks.layout === k} onClick={() => onChange({ layout: k })}>
              {label}
            </button>
          ))}
        </div>

        <label className="tw-lbl" htmlFor="tw-tagline">
          Tagline
        </label>
        <input
          id="tw-tagline"
          className="tw-txt"
          type="text"
          value={tweaks.tagline}
          onChange={(e) => onChange({ tagline: e.target.value })}
        />

        <label className="tw-lbl" htmlFor="tw-speed">
          Roll speed <b>{tweaks.scrollSpeed} px/s</b>
        </label>
        <input
          id="tw-speed"
          className="tw-range"
          type="range"
          min={8}
          max={90}
          step={1}
          value={tweaks.scrollSpeed}
          onChange={(e) => onChange({ scrollSpeed: +e.target.value })}
        />

        <label className="tw-lbl" htmlFor="tw-ad">
          Ad swaps every <b>{tweaks.adSeconds}s</b>
        </label>
        <input
          id="tw-ad"
          className="tw-range"
          type="range"
          min={2}
          max={15}
          step={1}
          value={tweaks.adSeconds}
          onChange={(e) => onChange({ adSeconds: +e.target.value })}
        />

        <label className="tw-toggle">
          <input
            type="checkbox"
            checked={tweaks.showTicker}
            onChange={(e) => onChange({ showTicker: e.target.checked })}
          />
          <span>Show top ticker</span>
        </label>
      </div>
    </div>
  );
}

export default function RollingSchedule() {
  const [tweaks, setTweaks] = useState<ScheduleTweaks>(TWEAKS_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [showTweaks, setShowTweaks] = useState(false);
  const [statusInfo, setStatusInfo] = useState<StatusInfo>(() =>
    computeStatus(SCHEDULE, SETTINGS.eventDate, SETTINGS.timezone)
  );

  useEffect(() => {
    setTweaks(loadTweaks());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const refresh = () => setStatusInfo(computeStatus(SCHEDULE, SETTINGS.eventDate, SETTINGS.timezone));
    refresh();
    const id = window.setInterval(refresh, 30000);
    return () => window.clearInterval(id);
  }, []);

  function patchTweaks(patch: Partial<ScheduleTweaks>) {
    setTweaks((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(TWEAKS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private browsing, etc.) — tweak still applies for this session
      }
      return next;
    });
  }

  function switchView() {
    patchTweaks({ layout: tweaks.layout === 'sidebar' ? 'classic' : 'sidebar' });
  }

  // wait for localStorage-backed tweaks to hydrate before rendering, so the
  // layout doesn't flash from default to saved settings on load
  if (!hydrated) return null;

  return (
    <div className={`rs lay-${tweaks.layout} ${FONT_VARS}`}>
      <Header tagline={tweaks.tagline} onSwitchView={switchView} onToggleTweaks={() => setShowTweaks((v) => !v)} />
      {tweaks.showTicker && <Ticker />}
      <NowBar statusInfo={statusInfo} />

      {tweaks.layout === 'classic' && (
        <>
          <div className="top">
            <PromoScreen />
            <AdCard adSeconds={tweaks.adSeconds} />
          </div>
          <Listings statusInfo={statusInfo} scrollSpeed={tweaks.scrollSpeed} />
        </>
      )}

      {tweaks.layout === 'sidebar' && (
        <div className="body">
          <Listings statusInfo={statusInfo} scrollSpeed={tweaks.scrollSpeed} />
          <div className="rail">
            <ChannelCard />
            <AdCard adSeconds={tweaks.adSeconds} />
          </div>
        </div>
      )}

      {tweaks.layout === 'fullroll' && (
        <>
          <Listings statusInfo={statusInfo} scrollSpeed={tweaks.scrollSpeed} />
          <AdStrip adSeconds={tweaks.adSeconds} />
        </>
      )}

      <Footer />
      {showTweaks && (
        <TweaksPanel tweaks={tweaks} onChange={patchTweaks} onClose={() => setShowTweaks(false)} />
      )}
    </div>
  );
}
