import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { room = 'event', userName, body, userId } = await request.json();

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 401 }
      );
    }

    if (!userName || !body) {
      return NextResponse.json(
        { error: 'userName and body are required' },
        { status: 400 }
      );
    }

    if (body.length > 600) {
      return NextResponse.json(
        { error: 'Message too long (max 600 characters)' },
        { status: 400 }
      );
    }

    // Check rate limit
    const { data: throttle } = await supabaseAdmin
      .from('chat_throttle')
      .select('last_msg_at')
      .eq('user_id', userId)
      .single();

    if (throttle) {
      const lastMessageTime = new Date(throttle.last_msg_at).getTime();
      const now = Date.now();
      const timeSinceLastMessage = now - lastMessageTime;
      const rateLimitMs = 2000; // 2 seconds

      if (timeSinceLastMessage < rateLimitMs) {
        const waitTime = Math.ceil((rateLimitMs - timeSinceLastMessage) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitTime} seconds before sending another message` },
          { status: 429 }
        );
      }
    }

    // Sanitize message (basic HTML escaping)
    const sanitizedBody = body
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();

    if (!sanitizedBody) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        room,
        user_id: userId,
        user_name: userName,
        kind: 'user',
        body: sanitizedBody,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert message:', error);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Update rate limit
    await supabaseAdmin
      .from('chat_throttle')
      .upsert({
        user_id: userId,
        last_msg_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      id: message.id,
      createdAt: message.created_at,
    }, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

