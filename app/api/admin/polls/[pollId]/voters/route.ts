import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { getDetailedVoteResults } from '@/lib/polls';

export async function GET(
  request: NextRequest,
  { params }: { params: { pollId: string } }
) {
  const session = await getAdminSession();

  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pollId } = params;

    if (!pollId) {
      return NextResponse.json(
        { error: 'pollId is required' },
        { status: 400 }
      );
    }

    const result = await getDetailedVoteResults(pollId);

    if (!result || !result.poll) {
      return NextResponse.json(
        { error: 'Poll not found' },
        { status: 404 }
      );
    }

    // Only allow viewing voter details for closed polls
    // This maintains privacy during active voting
    if (result.poll.is_open) {
      return NextResponse.json(
        { error: 'Voter details are only available for closed polls' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      poll: result.poll,
      detailedResults: result.detailedResults,
    });
  } catch (error) {
    console.error('Error fetching voter details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

