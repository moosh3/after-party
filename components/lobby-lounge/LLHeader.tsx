import { LL, LL_REEL, LL_VELVET } from './tokens';
import Reel from './Reel';

export default function LLHeader({
  tagline = 'where we like to watch movies',
  timestamp = '',
  lockText = 'MEMBERS ONLY · NO RANDOS',
  actions = null,
}: {
  tagline?: string;
  timestamp?: string;
  lockText?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header
      style={{
        padding: '12px 18px',
        background: LL_VELVET,
        borderBottom: `3px solid ${LL.mint}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        flexWrap: 'wrap',
        gap: 14,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 4,
          background: `linear-gradient(90deg, ${LL.frost2}, ${LL.mint} 30%, ${LL.lime} 55%, ${LL.yellow} 80%, ${LL.frost2})`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Reel size={60} mood="wave" palette={LL_REEL} />
        <div>
          <h1
            className="f-shade"
            style={{
              margin: 0,
              fontSize: 32,
              color: LL.lime,
              textShadow: `2px 2px 0 ${LL.ink}`,
              letterSpacing: '.01em',
            }}
          >
            WATCHIN&apos; DA MOVIES
          </h1>
          <p className="f-comic" style={{ margin: '2px 0 0', fontSize: 13, color: LL.frost2 }}>
            ~ {tagline} ~
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 5, justifyItems: 'end' }}>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
        <span className="lock-badge" style={{ background: LL.mint, color: LL.ink, border: `1.5px solid ${LL.ink}` }}>
          <span aria-hidden="true">🔒</span>
          {lockText}
        </span>
        {timestamp && (
          <span className="f-mono" style={{ fontSize: 14, color: LL.frost2 }}>
            {timestamp}
          </span>
        )}
      </div>
    </header>
  );
}
