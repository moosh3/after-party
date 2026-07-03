import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSession } from '@/lib/session';
import { resolveShowtimePlayout, type PlayoutMode } from '@/lib/showtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('current_stream')
    .select('playout_mode, schedule_early_ended_slot, schedule_early_ended_at')
    .eq('id', 1)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch playout mode' }, { status: 500 });
  }

  const mode: PlayoutMode = data.playout_mode || 'schedule';
  const schedule = resolveShowtimePlayout(new Date(), data.schedule_early_ended_slot);

  return NextResponse.json({
    mode,
    schedule,
    scheduleEarlyEndedSlot: data.schedule_early_ended_slot,
    scheduleEarlyEndedAt: data.schedule_early_ended_at,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mode } = await request.json();

  if (!['manual', 'schedule'].includes(mode)) {
    return NextResponse.json({ error: 'mode must be manual or schedule' }, { status: 400 });
  }

  const commandId = `mode-${mode}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const { data, error } = await supabaseAdmin
    .from('current_stream')
    .update({
      playout_mode: mode,
      schedule_early_ended_slot: null,
      schedule_early_ended_at: null,
      last_playback_command: 'mode_change',
      last_command_id: commandId,
    })
    .eq('id', 1)
    .select('playout_mode, schedule_early_ended_slot')
    .single();

  if (error) {
    console.error('Failed to update playout mode:', error);
    return NextResponse.json({ error: 'Failed to update playout mode' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    mode: data.playout_mode || mode,
    commandId,
    schedule: resolveShowtimePlayout(new Date(), data.schedule_early_ended_slot),
  });
}
