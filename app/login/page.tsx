'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LL_FONT_VARS } from '@/components/lobby-lounge/fonts';
import { LL } from '@/components/lobby-lounge/tokens';
import LLHeader from '@/components/lobby-lounge/LLHeader';
import FrostCard from '@/components/lobby-lounge/FrostCard';
import AvatarPicker from '@/components/lobby-lounge/AvatarPicker';
import { saveViewerData, getViewerData } from '@/lib/viewer';
import '@/components/lobby-lounge/lobby-lounge.css';

const inputStyle: React.CSSProperties = {
  border: `2.5px solid ${LL.ink}`,
  borderRadius: 8,
  background: '#fff',
  padding: '10px 12px',
  fontSize: 16,
  fontFamily: 'var(--ll-f-outfit), system-ui, sans-serif',
  boxShadow: 'inset 2px 2px 0 rgba(26,18,48,.15)',
  color: LL.ink,
};

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Who's Watchin'? · Da Movies";
    if (getViewerData()) {
      router.replace('/home');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    setError('');

    if (!avatar) return;

    setLoading(true);

    try {
      const response = await fetch('/api/viewer/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: name }),
      });
      const data = await response.json();

      if (!data.valid) {
        setError(data.error || 'Validation failed');
        setLoading(false);
        return;
      }

      saveViewerData(email, name, avatar);
      router.push('/home');
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      className={`dm-lobby-lounge ${LL_FONT_VARS}`}
      style={{
        background: LL.ink,
        color: LL.frost1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <a className="skip-link" href="#ll-login-main">
        Skip to content
      </a>
      <LLHeader tagline="where we like to watch movies" lockText="MEMBERS ONLY · NO RANDOS" timestamp="LOG IN" />

      <main id="ll-login-main" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '26px 18px 36px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <FrostCard title="★ WHO'S WATCHIN'?" meta="step 1 of 1" headBg={LL.ink} headText={LL.lime}>
            <form onSubmit={handleSubmit} style={{ padding: '20px 22px 24px', display: 'grid', gap: 16, color: LL.ink }}>
              <label className="f-comic" style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                name / username
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="how you'll show up in chat"
                  minLength={2}
                  maxLength={50}
                  disabled={loading}
                  style={inputStyle}
                />
              </label>

              <label className="f-comic" style={{ display: 'grid', gap: 4, fontSize: 14 }}>
                email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@wherever.com"
                  disabled={loading}
                  style={inputStyle}
                />
              </label>

              <div style={{ display: 'grid', gap: 9 }}>
                <span className="f-comic" style={{ fontSize: 14 }}>
                  pick ur avatar
                </span>
                <AvatarPicker picked={avatar} onPick={setAvatar} />
                {tried && !avatar && (
                  <span className="f-mono" role="alert" style={{ fontSize: 15, color: '#a31616' }}>
                    pick one, they don&apos;t bite
                  </span>
                )}
              </div>

              {error && (
                <span className="f-mono" role="alert" style={{ fontSize: 15, color: '#a31616' }}>
                  {error}
                </span>
              )}

              <button
                type="submit"
                disabled={loading}
                className="bevel-btn f-display"
                style={{
                  fontSize: 16,
                  padding: '12px 24px',
                  marginTop: 2,
                  borderRadius: 10,
                  background: `linear-gradient(180deg, ${LL.frost1} 0%, ${LL.lime} 55%, #95cc1f 100%)`,
                  color: LL.ink,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'CHECKING…' : 'ENTER THE LOUNGE ▶'}
              </button>
            </form>
          </FrostCard>
        </div>
      </main>

      <footer
        style={{
          padding: '12px 18px',
          background: LL.deep,
          color: LL.mint,
          borderTop: `3px solid ${LL.mint}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <span className="f-mono" style={{ fontSize: 14 }}>
          © 2026 damovies.watch · made by friends for friends
        </span>
        <span className="f-mono" style={{ fontSize: 14 }}>
          ★ invite only ★
        </span>
      </footer>
    </div>
  );
}
