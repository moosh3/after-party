export default function Marquee({
  items,
  color = '#ffe600',
  bg = '#1a0a3e',
  accent = '#ff2eb8',
}: {
  items: string[];
  color?: string;
  bg?: string;
  accent?: string;
}) {
  const row = (
    <>
      {items.map((it, i) => (
        <span key={i} style={{ color, fontWeight: 800, letterSpacing: '.02em' }}>
          <span style={{ color: accent, marginRight: 8 }} aria-hidden="true">
            ★
          </span>
          {it}
        </span>
      ))}
    </>
  );
  return (
    <div className="marq f-display" style={{ background: bg, fontSize: 14 }}>
      <div className="marq-track" aria-hidden="true">
        {row}
        {row}
      </div>
      <span className="sr-only">Announcements: {items.join('. ')}</span>
    </div>
  );
}
