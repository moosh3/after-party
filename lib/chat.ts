import { supabaseAdmin } from './supabase';

export async function sendSystemMessage(
  room: string,
  body: string
): Promise<void> {
  try {
    await supabaseAdmin.from('messages').insert({
      room,
      user_id: 'system',
      user_name: 'System',
      kind: 'system',
      body,
    });
  } catch (error) {
    console.error('Failed to send system message:', error);
  }
}

export async function getActiveUserCount(room: string): Promise<number> {
  // This is a simplified version
  // In production, you'd track active connections via Supabase Presence
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('user_id')
      .eq('room', room)
      .gte('created_at', fiveMinutesAgo);

    if (error) return 0;

    const uniqueUsers = new Set(data.map(m => m.user_id));
    return uniqueUsers.size;
  } catch (error) {
    console.error('Failed to get user count:', error);
    return 0;
  }
}

