import { LL } from './tokens';

export function LLCta({
  as: As = 'button',
  children,
  style,
  className,
  ...props
}: {
  as?: any;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: any;
}) {
  return (
    <As
      className={'f-display bevel-btn' + (className ? ' ' + className : '')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        textDecoration: 'none',
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: '.02em',
        color: LL.ink,
        padding: '8px 15px',
        borderRadius: 7,
        background: `linear-gradient(180deg, ${LL.frost1} 0%, ${LL.lime} 60%, #95cc1f 100%)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </As>
  );
}

export function LLPill({
  as: As = 'button',
  children,
  style,
  className,
  ...props
}: {
  as?: any;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  [key: string]: any;
}) {
  return (
    <As
      className={className}
      style={{
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 800,
        fontSize: 11,
        textDecoration: 'none',
        color: LL.frost1,
        background: 'rgba(255,255,255,.08)',
        border: `1.5px solid ${LL.frost3}`,
        borderRadius: 6,
        padding: '8px 11px',
        letterSpacing: '.04em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        ...style,
      }}
      {...props}
    >
      {children}
    </As>
  );
}
