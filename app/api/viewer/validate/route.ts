import { NextRequest, NextResponse } from 'next/server';

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json();

    // Validate inputs
    if (!email || !displayName) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Email and display name are required' 
        },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Invalid email format' 
        },
        { status: 400 }
      );
    }

    if (displayName.length < 2 || displayName.length > 50) {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Display name must be between 2 and 50 characters' 
        },
        { status: 400 }
      );
    }

    // All validations passed
    return NextResponse.json({
      valid: true,
      message: 'Viewer data is valid',
    });
  } catch (error) {
    console.error('Viewer validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

