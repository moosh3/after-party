import { NextRequest, NextResponse } from 'next/server';
import { getPollResults } from '@/lib/polls';

export async function GET(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  try {
    const { pollId } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    const pollData = await getPollResults(pollId, userId);

    if (!pollData) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ poll: pollData });
  } catch (error) {
    console.error('Error fetching poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

