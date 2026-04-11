export const config = {
  eventDate: process.env.NEXT_PUBLIC_EVENT_DATE || '',
  eventRoomId: process.env.EVENT_ROOM_ID || 'event',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || '',
};

export function isDevelopment(): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
    return true;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl.includes('placeholder') || supabaseUrl === '') {
    return true;
  }
  return false;
}

export function isProduction(): boolean {
  return !isDevelopment();
}