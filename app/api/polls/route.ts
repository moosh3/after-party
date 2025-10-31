import { NextRequest, NextResponse } from 'next/server';
import { getAllPolls } from '@/lib/polls';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room') || 'event';
    const userId = searchParams.get('userId') || undefined;

    const polls = await getAllPolls(room, userId);

    return NextResponse.json({ polls });
  } catch (error) {
    console.error('Error fetching polls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

