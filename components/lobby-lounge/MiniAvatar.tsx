import { findAvatar } from './avatars';
import { LL } from './tokens';

export default function MiniAvatar({ avatarId, size = 32, ring = LL.ink }: { avatarId?: string; size?: number; ring?: string }) {
  const avatar = findAvatar(avatarId);
  if (!avatar) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `2px solid ${ring}`,
        boxShadow: '2px 2px 0 rgba(0,0,0,.35)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatar.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </span>
  );
}
