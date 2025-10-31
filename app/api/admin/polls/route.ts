import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { getAllPolls } from '@/lib/polls';

export async function GET(request: NextRequest) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room') || 'event';

    const polls = await getAllPolls(room);

    return NextResponse.json({ polls });
  } catch (error) {
    console.error('Error fetching polls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

