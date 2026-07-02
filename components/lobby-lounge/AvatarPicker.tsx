import { AVATARS } from './avatars';
import { LL } from './tokens';

export default function AvatarPicker({
  picked,
  onPick,
}: {
  picked: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}
    >
      {AVATARS.map((a) => {
        const isPicked = picked === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            aria-pressed={isPicked}
            aria-label={`choose avatar ${a.id}`}
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: '50%',
              padding: 0,
              cursor: 'pointer',
              overflow: 'hidden',
              border: `3px solid ${isPicked ? LL.lime : LL.ink}`,
              boxShadow: isPicked ? `0 0 0 3px ${LL.ink}, 0 0 0 6px ${LL.lime}` : '2px 2px 0 rgba(0,0,0,.4)',
              transform: isPicked ? 'scale(1.06)' : 'none',
              transition: 'transform .12s',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        );
      })}
    </div>
  );
}
