import type { Metadata } from 'next';
import { LL_FONT_VARS } from '@/components/lobby-lounge/fonts';
import { LL } from '@/components/lobby-lounge/tokens';
import '@/components/lobby-lounge/lobby-lounge.css';

export const metadata: Metadata = {
  title: "You've Been Shown Out · Da Movies",
};

export default function DoorPage() {
  return (
    <div
      className={`dm-lobby-lounge ${LL_FONT_VARS}`}
      style={{ background: '#000', color: LL.frost1, position: 'relative', overflow: 'hidden', minHeight: '100vh' }}
    >
      <style>{`
        @keyframes ll-door-glow {
          0%, 100% { box-shadow: 1px 1px 0 rgba(0,0,0,.5); }
          50% { box-shadow: 0 0 14px 2px ${LL.mint}, 1px 1px 0 rgba(0,0,0,.5); }
        }
        .ll-door-lock { animation: ll-door-glow 2.6s ease-in-out infinite; }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '50%',
          background: `linear-gradient(180deg, ${LL.deep} 0%, ${LL.ink} 100%)`,
          borderRight: '3px solid #000',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: '50%',
          background: `linear-gradient(180deg, ${LL.deep} 0%, ${LL.ink} 100%)`,
          borderLeft: '3px solid #000',
        }}
      />

      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          <span className="lock-badge ll-door-lock" style={{ background: LL.mint, color: LL.ink, border: `1.5px solid ${LL.ink}` }}>
            <span aria-hidden="true">🔒</span>THIS DOOR&apos;S CLOSED
          </span>
          <h1 className="f-shade" style={{ margin: 0, fontSize: 'clamp(22px,4vw,30px)', color: LL.lime, textShadow: `2px 2px 0 ${LL.ink}` }}>
            you&apos;ve been shown out
          </h1>
          <p className="f-comic" style={{ margin: 0, fontSize: 14, color: LL.frost2, maxWidth: 340 }}>
            ask whoever invited you for a real one next time.
          </p>
        </div>
      </div>
    </div>
  );
}
