export default function NowPill({ name = '3 pals', label = 'watching' }: { name?: string; label?: string }) {
  return (
    <span className="now-pill" aria-label={`${name} ${label} now`}>
      <span className="dot" aria-hidden="true" />
      {name} {label}
    </span>
  );
}
