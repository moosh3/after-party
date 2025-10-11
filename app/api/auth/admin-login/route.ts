import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { createAdminSession, setAdminSessionCookie } from '@/lib/session';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { config } from '@/lib/config';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const identifier = getRateLimitIdentifier(request);
  const rateLimit = await checkRateLimit(identifier, { maxAttempts: 3, windowMs: 60000 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password, config.adminPasswordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const userId = 'admin';

    // Log admin login
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'login',
      admin_user: userId,
      details: { timestamp: new Date().toISOString() },
    });

    // Create admin session (8 hours)
    const token = await createAdminSession(userId);

    const response = NextResponse.json({
      success: true,
      message: 'Admin authenticated successfully',
    });

    setAdminSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

