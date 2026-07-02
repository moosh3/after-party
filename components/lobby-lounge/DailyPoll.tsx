'use client';

import { useState } from 'react';

// Visual-only placeholder poll per the design handoff — local tally, not
// backed by a database. Swap `question`/`options` for real content anytime;
// wiring this to a real vote-counting backend is a separate follow-up.
export default function DailyPoll({
  question = "What's tonight?",
  options = ['Action', 'Romcom', 'Horror', 'Cartoon'],
}: {
  question?: string;
  options?: string[];
}) {
  const [picked, setPicked] = useState(-1);
  const counts = [142, 87, 211, 64];
  const head = '#1f2b3a';
  const body = '#f5fbff';
  const text = '#1f2b3a';
  const accent = '#cbb6ff';
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <section className="win" aria-labelledby="poll-q" style={{ background: body, borderRadius: 14, overflow: 'hidden' }}>
      <div
        className="win-head"
        style={{ background: head, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}
      >
        <span className="f-display" style={{ fontSize: 13 }}>
          ☆ Daily Poll
        </span>
        <span className="f-mono" style={{ fontSize: 13, opacity: 0.8 }}>
          1/day
        </span>
      </div>
      <div style={{ padding: 14, color: text }}>
        <h3 id="poll-q" className="f-comic" style={{ margin: '0 0 8px', fontSize: 15, lineHeight: 1.15 }}>
          {question}
        </h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {options.map((opt, i) => {
            const pct = picked >= 0 ? Math.round((counts[i % counts.length] / total) * 100) : null;
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={picked === i}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: picked === i ? accent : 'transparent',
                    color: picked === i ? '#fff' : text,
                    border: `2px solid ${text}`,
                    borderRadius: 6,
                    padding: '7px 10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                    overflow: 'hidden',
                    fontSize: 13,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: picked === i ? '#fff' : 'transparent',
                      border: `2px solid ${picked === i ? '#fff' : text}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ position: 'relative', zIndex: 1 }}>{opt}</span>
                  {pct != null && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        position: 'relative',
                        zIndex: 1,
                        fontFamily: 'var(--ll-f-vt323), monospace',
                        fontSize: 15,
                      }}
                    >
                      {pct}%
                    </span>
                  )}
                  {pct != null && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pct}%`,
                        background: picked === i ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.08)',
                      }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {picked >= 0 && (
          <p className="f-mono" style={{ margin: '8px 0 0', fontSize: 14 }} role="status">
            you + {counts[picked % counts.length]} pals · come back tomorrow
          </p>
        )}
      </div>
    </section>
  );
}
