import { NextRequest, NextResponse } from 'next/server';
import { submitPollAnswer } from '@/lib/polls';

export async function POST(request: NextRequest) {
  try {
    const { pollId, userId, userName, answer } = await request.json();

    if (!pollId || !userId || !userName || !answer) {
      return NextResponse.json(
        { error: 'pollId, userId, userName, and answer are required' },
        { status: 400 }
      );
    }

    const result = await submitPollAnswer(pollId, userId, userName, answer);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, option: result.option }, { status: 201 });
  } catch (error) {
    console.error('Error submitting poll answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
