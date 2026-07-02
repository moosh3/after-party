import { LL, LL_FROST } from './tokens';

export default function FrostCard({
  children,
  style,
  headBg,
  headText,
  title,
  meta,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  headBg?: string;
  headText?: string;
  title?: string;
  meta?: string;
}) {
  return (
    <section
      className="win"
      style={{
        background: LL_FROST,
        border: `2px solid ${LL.ink}`,
        borderRadius: 14,
        boxShadow: '4px 4px 0 rgba(26,18,48,.35)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {title && (
        <div
          className="win-head"
          style={{
            background: headBg || LL.ink,
            color: headText || LL.lime,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `2px solid ${LL.ink}`,
          }}
        >
          <span className="f-display" style={{ fontSize: 13, letterSpacing: '.04em' }}>
            {title}
          </span>
          {meta && (
            <span className="f-mono" style={{ fontSize: 14, opacity: 0.85 }}>
              {meta}
            </span>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
