export interface AvatarOption {
  id: string;
  src: string;
}

const FILES = [
  'nic-1.jpeg', 'nic-2.jpeg', 'nic-3.jpg', 'nic-4.jpg',
  'nic-5.jpg', 'nic-6.jpg', 'nic-7.jpg', 'nic-8.jpeg',
  'nic-9.jpeg', 'nic-10.jpg', 'nic-11.jpg', 'nic-12.jpeg',
];

export const AVATARS: AvatarOption[] = FILES.map((file) => ({
  id: file.replace(/\.(jpe?g)$/i, ''),
  src: `/assets/images/avatars/nic/${file}`,
}));

export function findAvatar(id: string | undefined | null): AvatarOption | undefined {
  return AVATARS.find((a) => a.id === id);
}
