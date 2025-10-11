export const config = {
  eventDate: process.env.NEXT_PUBLIC_EVENT_DATE || '',
  eventRoomId: process.env.EVENT_ROOM_ID || 'event',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || '',
};

