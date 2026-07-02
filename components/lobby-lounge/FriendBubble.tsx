// Placeholder friend-group roster from the design handoff — swap these names/
// colors for your real crew whenever you're ready, this is just example data.
export const FRIENDS = [
  { n: 'mango', c: '#ff8c42', mood: '🍿' },
  { n: 'sprout', c: '#7ed957', mood: '👀' },
  { n: 'cleo', c: '#ff6cb1', mood: '💅' },
  { n: 'biz', c: '#5ec2ff', mood: '😎' },
  { n: 'fern', c: '#a978ff', mood: '🌿' },
  { n: 'tito', c: '#ffd84b', mood: '🐱' },
  { n: 'rin', c: '#ff5252', mood: '🔥' },
  { n: 'oz', c: '#22cabc', mood: '🛸' },
];

export interface Friend {
  n: string;
  c: string;
  mood: string;
}

export default function FriendBubble({ f, size = 38, ring = '#1a0a3e' }: { f: Friend; size?: number; ring?: string }) {
  return (
    <span
      role="img"
      aria-label={`${f.n}, status ${f.mood}`}
      title={f.n}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 25%, #fff7, ${f.c} 65%)`,
        border: `2.5px solid ${ring}`,
        boxShadow: '2px 2px 0 rgba(0,0,0,.35)',
        fontSize: size * 0.45,
        fontWeight: 800,
        color: '#120527',
        fontFamily: 'var(--ll-f-bungee), sans-serif',
      }}
    >
      {f.n[0].toUpperCase()}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -4,
          bottom: -4,
          background: '#fff',
          border: `2px solid ${ring}`,
          borderRadius: '50%',
          width: size * 0.42,
          height: size * 0.42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.22,
        }}
      >
        {f.mood}
      </span>
    </span>
  );
}
