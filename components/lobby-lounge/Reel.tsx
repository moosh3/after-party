type ReelMood = 'wave' | 'cheer' | 'sleepy' | 'excited' | 'smirk' | 'chill';

interface ReelPalette {
  body: string;
  rim: string;
  hole: string;
  face: string;
  pupil: string;
  cheek: string;
  mouth: string;
}

const DEFAULT_PALETTE: ReelPalette = {
  body: '#1a0a3e',
  rim: '#ffe600',
  hole: '#ffe600',
  face: '#fff5d6',
  pupil: '#1a0a3e',
  cheek: '#ff2eb8',
  mouth: '#1a0a3e',
};

export default function Reel({
  size = 72,
  mood = 'wave',
  palette,
}: {
  size?: number;
  mood?: ReelMood;
  palette?: ReelPalette;
}) {
  const p = palette || DEFAULT_PALETTE;

  const mouths: Record<ReelMood, React.ReactNode> = {
    wave: <path d="M 36 60 Q 50 70 64 60" stroke={p.mouth} strokeWidth={3.5} strokeLinecap="round" fill="none" />,
    cheer: <path d="M 34 56 Q 50 76 66 56 Q 50 64 34 56 Z" fill={p.mouth} />,
    sleepy: <path d="M 38 62 Q 50 64 62 62" stroke={p.mouth} strokeWidth={3.5} strokeLinecap="round" fill="none" />,
    excited: <ellipse cx={50} cy={62} rx={7} ry={5} fill={p.mouth} />,
    smirk: <path d="M 38 60 Q 50 66 62 58" stroke={p.mouth} strokeWidth={3.5} strokeLinecap="round" fill="none" />,
    chill: <path d="M 38 60 L 62 60" stroke={p.mouth} strokeWidth={3.5} strokeLinecap="round" fill="none" />,
  };

  const eyes =
    mood === 'sleepy' ? (
      <>
        <path d="M 38 47 Q 42 51 46 47" stroke={p.pupil} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <path d="M 54 47 Q 58 51 62 47" stroke={p.pupil} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </>
    ) : (
      <>
        <ellipse cx={42} cy={46} rx={4} ry={5} fill={p.pupil} />
        <ellipse cx={58} cy={46} rx={4} ry={5} fill={p.pupil} />
        <circle cx={43.5} cy={44.5} r={1.4} fill="#fff" />
        <circle cx={59.5} cy={44.5} r={1.4} fill="#fff" />
      </>
    );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g>
        <circle cx={50} cy={50} r={44} fill={p.body} />
        <circle cx={50} cy={50} r={44} fill="none" stroke={p.rim} strokeWidth={4} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i * Math.PI * 2) / 8;
          const cx = 50 + Math.cos(a) * 34;
          const cy = 50 + Math.sin(a) * 34;
          return <circle key={i} cx={cx} cy={cy} r={3.5} fill={p.hole} />;
        })}
      </g>
      <circle cx={50} cy={52} r={22} fill={p.face} />
      <circle cx={50} cy={52} r={22} fill="none" stroke={p.body} strokeWidth={2.5} />
      <circle cx={35} cy={56} r={3} fill={p.cheek} opacity={0.7} />
      <circle cx={65} cy={56} r={3} fill={p.cheek} opacity={0.7} />
      {eyes}
      {mouths[mood] || mouths.wave}
    </svg>
  );
}
