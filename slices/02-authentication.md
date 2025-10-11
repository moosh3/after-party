# Slice 02: Authentication System

## Overview
Implement a lightweight registration system for viewers (email + display name stored locally) and secure password-based authentication for administrators.

## Goals
- Implement viewer registration with email and display name (no password)
- Store viewer data in browser localStorage for persistence
- Implement admin authentication with password-based sessions
- Create secure session management for admins
- Add rate limiting to admin auth endpoints
- Build registration and login UI components

## Dependencies
- **Slice 01**: Project foundation must be complete

## Technical Requirements

### 1. Admin Session Management

**File: `lib/session.ts`**
```typescript
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'fallback-secret-change-in-production'
);

export interface AdminSessionData {
  userId: string;
  role: 'admin';
  createdAt: number;
  expiresAt: number;
}

export async function createAdminSession(userId: string = 'admin'): Promise<string> {
  const expiresAt = Date.now() + (8 * 60 * 60 * 1000); // 8 hours
  
  const sessionData: AdminSessionData = {
    userId,
    role: 'admin',
    createdAt: Date.now(),
    expiresAt,
  };

  const token = await new SignJWT({ ...sessionData })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(new Date(expiresAt))
    .sign(SESSION_SECRET);

  return token;
}

export async function verifyAdminSession(token: string): Promise<AdminSessionData | null> {
  try {
    const verified = await jwtVerify(token, SESSION_SECRET);
    return verified.payload as unknown as AdminSessionData;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionData | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_session')?.value;
  
  if (!token) return null;
  
  return verifyAdminSession(token);
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
    path: '/',
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.delete('admin_session');
}
```

### 2. Viewer Data Management

**File: `lib/viewer.ts`**
```typescript
// Client-side viewer data management
export interface ViewerData {
  id: string;
  email: string;
  displayName: string;
  registeredAt: number;
}

const VIEWER_STORAGE_KEY = 'after_party_viewer';

export function generateViewerId(): string {
  return `viewer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function saveViewerData(email: string, displayName: string): ViewerData {
  const viewerData: ViewerData = {
    id: generateViewerId(),
    email,
    displayName,
    registeredAt: Date.now(),
  };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify(viewerData));
  }
  
  return viewerData;
}

export function getViewerData(): ViewerData | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(VIEWER_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as ViewerData;
  } catch {
    return null;
  }
}

export function clearViewerData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(VIEWER_STORAGE_KEY);
  }
}

export function isViewerRegistered(): boolean {
  return getViewerData() !== null;
}
```

### 3. Admin Password Utilities

**File: `lib/auth.ts`**
```typescript
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 4. Rate Limiting (Admin Only)

**File: `lib/rate-limit.ts`**
```typescript
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxAttempts: 3, windowMs: 60000 }
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  if (record.count >= config.maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: config.maxAttempts - record.count };
}

export function getRateLimitIdentifier(request: Request): string {
  // Use IP for rate limiting
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `admin_auth:${ip}`;
}
```

### 5. Viewer Validation API

**File: `app/api/viewer/validate/route.ts`**
```typescript
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
```

### 6. Admin Login API

**File: `app/api/auth/admin-login/route.ts`**
```typescript
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
```

### 7. Admin Logout API

**File: `app/api/auth/admin-logout/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/session';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  clearAdminSessionCookie(response);

  return response;
}
```

### 8. Admin Auth Middleware Helper

**File: `lib/middleware.ts`**
```typescript
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
```

### 9. Viewer Registration Component

**File: `components/ViewerRegistration.tsx`**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { saveViewerData, getViewerData } from '@/lib/viewer';

interface ViewerRegistrationProps {
  onComplete: () => void;
}

export default function ViewerRegistration({ onComplete }: ViewerRegistrationProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if viewer is already registered
    const existingData = getViewerData();
    if (existingData) {
      onComplete();
    }
  }, [onComplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate with server
      const response = await fetch('/api/viewer/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });

      const data = await response.json();

      if (!data.valid) {
        setError(data.error || 'Validation failed');
        setLoading(false);
        return;
      }

      // Save to localStorage
      saveViewerData(email, displayName);

      // Proceed to event
      onComplete();
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md">
      <h2 className="text-3xl font-bold text-white mb-2">Join the Event</h2>
      <p className="text-slate-400 mb-6">
        Enter your details to access the livestream and chat
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="How you'll appear in chat"
            required
            minLength={2}
            maxLength={50}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? 'Validating...' : 'Continue to Event'}
        </button>
      </form>

      <p className="text-xs text-slate-500 mt-4 text-center">
        Your information is stored locally in your browser
      </p>
    </div>
  );
}
```

### 10. Admin Login Page

**File: `app/admin/login/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/admin');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Login</h1>
        <p className="text-slate-400 mb-6">Enter admin credentials to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter admin password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Authenticating...' : 'Login as Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### 11. Admin Password Hash Generator Script

**File: `scripts/generate-admin-hash.ts`**
```typescript
import bcrypt from 'bcryptjs';

async function generateHash(password: string) {
  const hash = await bcrypt.hash(password, 12);
  console.log('\nAdmin Password Hash:');
  console.log(hash);
  console.log('\nAdd this to your .env.local file:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
}

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run generate-admin-hash <password>');
  process.exit(1);
}

generateHash(password);
```

**Add to `package.json` scripts:**
```json
{
  "scripts": {
    "generate-admin-hash": "ts-node scripts/generate-admin-hash.ts"
  }
}
```

## Implementation Tasks

**Viewer Registration:**
- [ ] Create `lib/viewer.ts` with client-side viewer data management
- [ ] Implement `/api/viewer/validate` endpoint for server-side validation
- [ ] Create `ViewerRegistration` component
- [ ] Integrate viewer registration into event page

**Admin Authentication:**
- [ ] Create `lib/session.ts` with JWT session management for admins
- [ ] Create `lib/auth.ts` with password hashing utilities
- [ ] Create `lib/rate-limit.ts` with rate limiting for admin login
- [ ] Create `lib/middleware.ts` with admin auth middleware helper
- [ ] Implement `/api/auth/admin-login` endpoint
- [ ] Implement `/api/auth/admin-logout` endpoint
- [ ] Create admin login page (`/admin/login`)
- [ ] Create admin password hash generator script
- [ ] Generate and store admin password hash

**Configuration:**
- [ ] Update `.env.example` with `ADMIN_PASSWORD_HASH`
- [ ] Add `SESSION_SECRET` to environment variables
- [ ] Update config to remove viewer password requirement

## Acceptance Criteria

✅ **Viewer Registration:**
- [ ] Users can access event page and see registration form
- [ ] Form requires email and display name (2-50 characters)
- [ ] Email validation is enforced
- [ ] Viewer data is saved to localStorage
- [ ] Registration persists across page reloads
- [ ] Users who are already registered bypass the form
- [ ] Users can clear registration and re-register if needed

✅ **Admin Authentication:**
- [ ] Can access `/admin/login` and see login form
- [ ] Correct admin password grants access
- [ ] Incorrect password shows error message
- [ ] Rate limiting prevents brute force (3 attempts/minute)
- [ ] Admin session persists for 8 hours
- [ ] Admin login is logged in `admin_actions` table
- [ ] Admin logout clears session cookie

✅ **Security:**
- [ ] Admin passwords are never transmitted in URLs
- [ ] Admin session cookies are httpOnly and secure
- [ ] Password hashes use bcrypt with cost factor 12
- [ ] Rate limiting is enforced server-side for admin login
- [ ] Viewer data stays client-side (localStorage only)
- [ ] No sensitive data exposed in client-side code

✅ **UX:**
- [ ] Forms are responsive and accessible
- [ ] Error messages are user-friendly
- [ ] Loading states prevent double submission
- [ ] Successful registration/login transitions smoothly
- [ ] Clear visual distinction between viewer and admin flows

## Testing

**Manual Tests:**
1. **Viewer Registration:**
   - Navigate to `/event` → should see registration form
   - Submit with invalid email → should see error
   - Submit with display name < 2 chars → should see error
   - Submit valid data → data should be saved to localStorage
   - Refresh page → should not see form again (already registered)
   - Clear localStorage → should see form again
   - Check localStorage in browser dev tools for viewer data

2. **Admin Login:**
   - Navigate to `/admin/login` → should see login form
   - Try wrong password → should see error
   - Try correct password → should redirect to `/admin`
   - Check cookie is set (browser dev tools - `admin_session`)
   - Verify admin action logged in database
   - Try accessing admin endpoints without auth → 401

3. **Rate Limiting (Admin):**
   - Make 4 failed admin login attempts → should get 429 error
   - Wait 1 minute → should be able to try again

4. **Persistence:**
   - Register as viewer, close tab, open new tab to `/event` → should be registered
   - Login as admin, close tab, open new tab to `/admin` → should still be logged in (for 8h)

**Automated Tests:**
```typescript
// test/auth.test.ts
describe('Admin Authentication', () => {
  it('should hash passwords correctly', async () => {
    const password = 'test123';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should create valid admin session tokens', async () => {
    const token = await createAdminSession('admin');
    const session = await verifyAdminSession(token);
    expect(session?.userId).toBe('admin');
    expect(session?.role).toBe('admin');
  });
});

// test/viewer.test.ts
describe('Viewer Data Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save and retrieve viewer data', () => {
    const data = saveViewerData('test@example.com', 'Test User');
    expect(data.email).toBe('test@example.com');
    expect(data.displayName).toBe('Test User');

    const retrieved = getViewerData();
    expect(retrieved?.email).toBe('test@example.com');
  });

  it('should detect if viewer is registered', () => {
    expect(isViewerRegistered()).toBe(false);
    saveViewerData('test@example.com', 'Test User');
    expect(isViewerRegistered()).toBe(true);
  });
});
```

## Notes

**Viewer Registration:**
- No password required for viewers - frictionless onboarding
- Email and display name stored in browser localStorage
- Data persists across sessions but stays on client-side
- Users can clear localStorage to "log out" and re-register
- Display name will be used for chat identification in later slices

**Admin Authentication:**
- Use bcrypt with cost factor 12 (OWASP recommendation)
- Session tokens use HS256 JWT algorithm
- Admin sessions are shorter (8h) for security
- Rate limiting is in-memory (fine for single instance, use Redis for horizontal scaling)
- Admin actions are logged for audit trail

**Security Considerations:**
- Viewer data is not authenticated server-side (trust the client)
- This is acceptable for non-sensitive operations (viewing stream, chat)
- For critical operations (e.g., voting, purchases), implement server-side verification
- Admin operations always require server-side session validation

## Next Slice

After completing authentication, proceed to **Slice 03: Video Playback** to implement the core video streaming functionality.

