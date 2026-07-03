import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canMarkActiveSlotEnded, resolveShowtimePlayout } from '@/lib/showtime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { slotId, playbackId } = await request.json();

    if (!slotId || !playbackId) {
      return NextResponse.json({ error: 'slotId and playbackId are required' }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from('current_stream')
      .select('playout_mode, schedule_early_ended_slot')
      .eq('id', 1)
      .single();

    if (currentError) {
      return NextResponse.json({ error: 'Failed to read playout state' }, { status: 500 });
    }

    if ((current.playout_mode || 'schedule') !== 'schedule') {
      return NextResponse.json({ success: true, ignored: true, reason: 'manual-mode' });
    }

    const resolved = resolveShowtimePlayout(new Date(), current.schedule_early_ended_slot);

    if (resolved.activeSlotId !== slotId || resolved.playbackId !== playbackId) {
      return NextResponse.json(
        { success: true, ignored: true, reason: 'not-active-slot' },
        { status: 202 }
      );
    }

    if (!canMarkActiveSlotEnded(slotId, playbackId)) {
      return NextResponse.json(
        { success: true, ignored: true, reason: 'too-early' },
        { status: 202 }
      );
    }

    const commandId = `slot-ended-${slotId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const { error } = await supabaseAdmin
      .from('current_stream')
      .update({
        schedule_early_ended_slot: slotId,
        schedule_early_ended_at: new Date().toISOString(),
        last_playback_command: 'schedule_slot_ended',
        last_command_id: commandId,
      })
      .eq('id', 1);

    if (error) {
      console.error('Failed to mark scheduled slot ended:', error);
      return NextResponse.json({ error: 'Failed to mark scheduled slot ended' }, { status: 500 });
    }

    return NextResponse.json({ success: true, commandId });
  } catch (error) {
    console.error('Error marking scheduled slot ended:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
