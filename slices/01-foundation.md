# Slice 01: Project Foundation & Setup

## Overview
Establish the technical foundation for the event streaming platform, including project structure, dependencies, database schema, and deployment pipeline.

## Goals
- Initialize Next.js 14+ project with TypeScript
- Configure Supabase database with core schema
- Set up Mux account and obtain credentials
- Deploy initial "hello world" to Vercel staging
- Establish environment variable management

## Dependencies
- None (this is the first slice)

## Technical Requirements

### 1. Project Initialization

**Technology Stack:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Node.js 18+

**Required Dependencies:**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.38.0",
    "@mux/mux-node": "^8.0.0",
    "hls.js": "^1.5.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.2.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### 2. Database Schema (Supabase)

**SQL Migration: `schema.sql`**
```sql
-- Active stream configuration
CREATE TABLE current_stream (
  id int PRIMARY KEY DEFAULT 1,
  playback_id text NOT NULL,
  title text NOT NULL,
  kind text CHECK (kind IN ('vod', 'live')) DEFAULT 'vod',
  updated_at timestamptz DEFAULT now(),
  updated_by text,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Mux asset catalog
CREATE TABLE mux_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playback_id text UNIQUE NOT NULL,
  kind text CHECK (kind IN ('vod', 'live')),
  label text,
  duration_seconds int,
  created_at timestamptz DEFAULT now()
);

-- Chat messages
CREATE TABLE messages (
  id bigserial PRIMARY KEY,
  room text NOT NULL DEFAULT 'event',
  user_id text NOT NULL,
  user_name text NOT NULL,
  kind text CHECK (kind IN ('user', 'system', 'poll')) DEFAULT 'user',
  body text NOT NULL CHECK (length(body) <= 600),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_messages_room_created ON messages(room, created_at DESC);

-- Polls
CREATE TABLE polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL DEFAULT 'event',
  question text NOT NULL CHECK (length(question) <= 300),
  is_open boolean DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

-- Poll options
CREATE TABLE poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) <= 100),
  idx int NOT NULL,
  UNIQUE (poll_id, idx)
);

-- Poll votes
CREATE TABLE poll_votes (
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  voted_at timestamptz DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- Chat rate limiting
CREATE TABLE chat_throttle (
  user_id text PRIMARY KEY,
  last_msg_at timestamptz NOT NULL
);

-- Admin audit log
CREATE TABLE admin_actions (
  id bigserial PRIMARY KEY,
  action_type text NOT NULL,
  admin_user text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (read-only for now, will be enhanced in auth slice)
CREATE POLICY "Allow read access to all" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to all" ON polls
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to all" ON poll_options
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to all" ON poll_votes
  FOR SELECT USING (true);
```

### 3. Environment Variables

**File: `.env.example`**
```bash
# Next.js
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_SIGNING_KEY_ID=
MUX_SIGNING_KEY_PRIVATE=

# Auth
VIEWER_PASSWORD_HASH=
ADMIN_PASSWORD_HASH=
SESSION_SECRET=

# App Config
NEXT_PUBLIC_EVENT_DATE=2025-12-31T19:00:00Z
EVENT_ROOM_ID=event
```

### 4. Project Structure

```
/
├── app/
│   ├── layout.tsx          # Root layout with Tailwind
│   ├── page.tsx            # Landing page
│   ├── event/
│   │   └── page.tsx        # Viewer event page (placeholder)
│   ├── admin/
│   │   └── page.tsx        # Admin panel (placeholder)
│   └── api/
│       └── health/
│           └── route.ts    # Health check endpoint
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── mux.ts              # Mux client
│   └── config.ts           # App configuration
├── components/
│   └── ui/                 # Shared UI components (empty for now)
├── public/
├── sql/
│   └── schema.sql          # Database schema
├── .env.local              # Local environment variables (gitignored)
├── .env.example            # Example environment variables
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 5. Core Library Files

**File: `lib/supabase.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for API routes)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

**File: `lib/mux.ts`**
```typescript
import Mux from '@mux/mux-node';

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export default mux;

export function generatePlaybackToken(playbackId: string): string {
  const token = Mux.JWT.signPlaybackId(playbackId, {
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
    expiration: '1h',
    type: 'video',
  });
  return token;
}
```

**File: `lib/config.ts`**
```typescript
export const config = {
  eventDate: process.env.NEXT_PUBLIC_EVENT_DATE || '',
  eventRoomId: process.env.EVENT_ROOM_ID || 'event',
  viewerPasswordHash: process.env.VIEWER_PASSWORD_HASH || '',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  sessionSecret: process.env.SESSION_SECRET || '',
};
```

### 6. Basic Pages

**File: `app/page.tsx`**
```typescript
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Event Streaming Platform</h1>
        <p className="text-slate-400 mb-8">Private event streaming coming soon</p>
        <div className="space-x-4">
          <a 
            href="/event" 
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg inline-block"
          >
            Join Event
          </a>
          <a 
            href="/admin" 
            className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg inline-block"
          >
            Admin Panel
          </a>
        </div>
      </div>
    </main>
  );
}
```

**File: `app/api/health/route.ts`**
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'event-streaming-platform',
  });
}
```

### 7. Tailwind Configuration

**File: `tailwind.config.js`**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#64748b',
        success: '#10b981',
        error: '#ef4444',
      },
    },
  },
  plugins: [],
}
```

### 8. Deployment Configuration

**File: `vercel.json`** (optional, Vercel auto-detects Next.js)
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

## Implementation Tasks

- [ ] Run `npx create-next-app@latest` with TypeScript and Tailwind
- [ ] Install additional dependencies (@supabase, @mux/mux-node, hls.js, bcryptjs, jose)
- [ ] Create Supabase project at supabase.com
- [ ] Run schema.sql in Supabase SQL editor
- [ ] Enable Realtime for `messages` and `current_stream` tables
- [ ] Create Mux account and generate API keys
- [ ] Create Mux signing key pair
- [ ] Create `.env.local` from `.env.example`
- [ ] Configure Vercel project and add environment variables
- [ ] Create basic file structure
- [ ] Implement core library files (supabase.ts, mux.ts, config.ts)
- [ ] Create placeholder pages (/, /event, /admin)
- [ ] Deploy to Vercel staging
- [ ] Test health check endpoint
- [ ] Verify Supabase connection works
- [ ] Generate and store password hashes for viewer and admin

## Acceptance Criteria

✅ **Project Setup:**
- [ ] Next.js 14+ project runs locally with `npm run dev`
- [ ] TypeScript compilation has no errors
- [ ] Tailwind CSS is functioning (verified in browser)

✅ **Database:**
- [ ] Supabase project created
- [ ] All tables created successfully
- [ ] RLS policies enabled
- [ ] Connection from Next.js to Supabase works

✅ **Services:**
- [ ] Mux account configured
- [ ] Mux token signing works (verified with test script)
- [ ] Environment variables loaded correctly

✅ **Deployment:**
- [ ] Deployed to Vercel staging
- [ ] `/api/health` returns 200 OK
- [ ] Environment variables configured in Vercel
- [ ] No console errors on page load

✅ **Documentation:**
- [ ] `.env.example` is complete and accurate
- [ ] README.md includes setup instructions
- [ ] Folder structure is clean and organized

## Testing

**Manual Tests:**
1. Visit staging URL → should see landing page
2. Click "Join Event" → should see placeholder page (no errors)
3. Click "Admin Panel" → should see placeholder page (no errors)
4. Visit `/api/health` → should return JSON with status "ok"

**Environment Tests:**
```bash
# Test Supabase connection
npm run test:supabase

# Test Mux token generation
npm run test:mux
```

## Notes

- Use Node.js 18+ for native fetch support
- Keep environment variables in 1Password/secure vault
- Don't commit `.env.local` to git
- Use `NEXT_PUBLIC_` prefix only for client-side variables
- Supabase free tier supports 500MB database (sufficient for this use case)
- Mux offers $20 free credit (covers initial testing)

## Next Slice

After completing this foundation, proceed to **Slice 02: Authentication System** to implement viewer and admin authentication.

