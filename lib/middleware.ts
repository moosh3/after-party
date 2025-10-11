import { NextResponse } from 'next/server';
import { getAdminSession, AdminSessionData } from './session';

export async function requireAdminAuth(): Promise<{ 
  authorized: boolean; 
  session: AdminSessionData | null; 
  response?: NextResponse 
}> {
  const session = await getAdminSession();

  if (!session) {
    return {
      authorized: false,
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { authorized: true, session };
}

