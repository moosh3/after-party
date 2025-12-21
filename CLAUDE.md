# CLAUDE.md - AI Assistant Guide for After-Party

> **Purpose:** This document helps AI assistants understand the after-party codebase structure, conventions, and best practices for making changes safely and effectively.

**Last Updated:** 2025-12-21
**Project:** Event Streaming Platform (Next.js 14 + Supabase + Mux)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Directory Structure](#directory-structure)
4. [Key Conventions](#key-conventions)
5. [Development Patterns](#development-patterns)
6. [Critical Gotchas](#critical-gotchas)
7. [Common Tasks](#common-tasks)
8. [Testing & Validation](#testing--validation)

---

## Project Overview

**After-Party** is a private event streaming platform for live and VOD content delivery with real-time chat, interactive polls, and synchronized video playback.

### Core Features
- 🎥 Synchronized video playback powered by Mux (live + VOD)
- 💬 Real-time chat with Supabase Realtime
- 📊 Interactive polling system
- 🔐 Two-tier authentication (admin JWT + viewer registration)
- 👨‍💼 Admin panel for content and playback control
- 🎨 Twitch-inspired UI with dark mode

### Project Goals
- Deliver synchronized viewing experience across all viewers
- Handle unreliable network conditions gracefully
- Provide real-time interactivity (chat, polls, playback sync)
- Enable admin control without viewer disruption

---

## Tech Stack & Architecture

### Core Technologies
- **Framework:** Next.js 14.2.0 with App Router
- **Language:** TypeScript 5.2.0 (strict mode)
- **Frontend:** React 18.2.0 (client components)
- **Database:** Supabase (PostgreSQL + Realtime)
- **Video:** Mux (streaming + player)
- **Styling:** Tailwind CSS 3.3.0
- **Authentication:** Custom JWT sessions (httpOnly cookies)
- **Deployment:** Vercel (also supports Docker + Kubernetes)

### Key Dependencies
```json
{
  "@supabase/supabase-js": "^2.78.0",    // Database + Realtime
  "@mux/mux-node": "^8.0.0",             // Mux API (server)
  "@mux/mux-player-react": "^3.8.0",     // Video player (client)
  "bcryptjs": "^2.4.3",                  // Password hashing
  "jose": "^5.0.0",                       // JWT generation
  "hls.js": "^1.5.0"                     // HLS streaming (via Mux)
}
```

### Architecture Pattern
**Full-stack Next.js application:**
- **Server:** API routes handle auth, database, Mux integration
- **Client:** React components with real-time subscriptions
- **Database:** PostgreSQL via Supabase with RLS policies
- **Real-time:** Supabase Realtime (PostgreSQL CDC) + polling fallback
- **Video:** Mux-hosted HLS streams with signed tokens

---

## Directory Structure

```
/home/user/after-party/
│
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with metadata
│   ├── page.tsx                 # Landing page
│   ├── event/page.tsx           # Event viewer (main streaming page)
│   ├── admin/                   # Admin dashboard
│   │   ├── page.tsx            # Admin panel (auth required)
│   │   └── login/page.tsx       # Admin login
│   └── api/                      # API route handlers
│       ├── health/route.ts      # Health check
│       ├── auth/                # Login/logout endpoints
│       ├── chat/                # Chat operations
│       ├── polls/               # Poll operations
│       ├── current/route.ts     # Get current stream state
│       ├── admin/               # Admin-only operations
│       │   ├── playback-control/route.ts
│       │   ├── queue/route.ts
│       │   ├── mux-items/route.ts
│       │   ├── hold-screen/route.ts
│       │   ├── toggle-poster/route.ts
│       │   └── messages/delete/route.ts
│       └── viewer/validate/route.ts
│
├── lib/                         # Core utilities & business logic
│   ├── supabase.ts             # Client-side Supabase (anon key)
│   ├── supabase-admin.ts       # Server-side Supabase (service role) ⚠️
│   ├── mux.ts                  # Mux API integration
│   ├── auth.ts                 # Password hashing utilities
│   ├── session.ts              # JWT session management
│   ├── middleware.ts           # Auth middleware
│   ├── config.ts               # Environment configuration
│   ├── chat.ts                 # Chat utilities
│   ├── polls.ts                # Poll utilities
│   ├── viewer.ts               # Viewer localStorage management
│   ├── rate-limit.ts           # Basic rate limiting
│   └── rate-limit-enhanced.ts  # Middleware rate limiting
│
├── components/                  # React components (all client-side)
│   ├── Chat.tsx                # Real-time chat
│   ├── VideoPlayer.tsx         # Synchronized video player ⚠️
│   ├── PollCard.tsx            # Poll voting UI
│   ├── PollsTab.tsx            # Polls list
│   ├── ViewerRegistration.tsx  # Display name registration
│   ├── EventCountdown.tsx      # Event countdown timer
│   └── admin/                  # Admin components
│       ├── StreamControl.tsx
│       ├── PlaybackControls.tsx
│       └── QueueManager.tsx
│
├── hooks/                       # React custom hooks
│   ├── useRealtimeHealth.ts    # Monitor Realtime connection status
│   ├── useStreamUpdates.ts     # Stream changes with fallback polling
│   └── useTokenRefresh.ts      # Refresh Mux playback tokens
│
├── sql/                         # Database migrations
│   ├── 001_schema.sql          # Core schema + RLS
│   ├── 002-013_*.sql           # Feature migrations
│   └── 013_fix_sync_restarts.sql # Video sync fixes ⚠️
│
├── scripts/                     # CLI utilities
│   ├── setup-database.ts       # Initialize database
│   ├── seed-demo-data.ts       # Populate demo data
│   ├── enable-realtime.ts      # Enable Realtime on tables
│   └── generate-admin-hash.ts  # Hash admin passwords
│
├── public/assets/               # Static assets
│   ├── logos/
│   ├── images/
│   ├── backgrounds/
│   └── fonts/                   # Custom Ethna font
│
├── helm/                        # Kubernetes deployment
├── Dockerfile                   # Docker build config
├── next.config.js              # Next.js configuration
├── tsconfig.json               # TypeScript strict mode
└── tailwind.config.js          # Twitch-inspired theme
```

**⚠️ = Critical files - modify with care**

---

## Key Conventions

### 1. File Naming

| Type | Pattern | Example |
|------|---------|---------|
| API Routes | `route.ts` in folder | `/api/admin/polls/route.ts` |
| Pages | `page.tsx` in folder | `/app/event/page.tsx` |
| Components | `PascalCase.tsx` | `VideoPlayer.tsx` |
| Utilities | `camelCase.ts` | `supabase-admin.ts` |
| Hooks | `useHookName.ts` | `useStreamUpdates.ts` |
| Database | `snake_case` | `current_stream`, `mux_items` |

### 2. Import Patterns

**ALWAYS use absolute imports with `@/` alias:**

```typescript
// ✅ Correct
import { supabase } from '@/lib/supabase';
import { Chat } from '@/components/Chat';

// ❌ Incorrect
import { supabase } from '../../../../lib/supabase';
```

### 3. TypeScript Patterns

- **Strict mode enabled** - never use `any`
- Use `interfaces` for object types, not `type` aliases
- Always await async operations
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Never suppress errors with `@ts-ignore`

```typescript
// Good pattern
interface Message {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
}

const message: Message = await fetchMessage();
const displayName = message.user_name ?? 'Anonymous';
```

### 4. Component Patterns

**All components are client-side:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MyComponent() {
  const [data, setData] = useState<Type[]>([]);

  useEffect(() => {
    // Load initial data
    async function load() {
      const response = await fetch('/api/endpoint');
      const result = await response.json();
      setData(result.data);
    }
    load();
  }, []);

  useEffect(() => {
    // Subscribe to real-time changes
    const channel = supabase
      .channel('unique-channel-name')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'table_name' },
        (payload) => {
          setData(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return <div>{/* UI */}</div>;
}
```

### 5. API Route Patterns

**Consistent structure for all API routes:**

```typescript
// app/api/resource/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication (if required)
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const { field1, field2 } = await request.json();

    // 3. Validation
    if (!field1) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    // 4. Database operation (ALWAYS use supabaseAdmin)
    const { data, error } = await supabaseAdmin
      .from('table_name')
      .insert({ field1, field2 })
      .select()
      .single();

    if (error) throw error;

    // 5. Log admin action (for important operations)
    await supabaseAdmin.from('admin_actions').insert({
      action_type: 'action_name',
      admin_user: session.adminId,
      details: { field1, field2 }
    });

    // 6. Return success response
    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Status Code Standards:**
- `200` - Success (GET, PATCH)
- `201` - Created (POST)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (auth required)
- `404` - Not Found
- `500` - Internal Server Error (unexpected errors)

---

## Development Patterns

### 1. Database Access

**⚠️ CRITICAL: Two Supabase Clients**

```typescript
// lib/supabase.ts - CLIENT-SIDE ONLY
// Uses anon key, safe for browser, limited by RLS policies
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(url, anonKey);

// lib/supabase-admin.ts - SERVER-SIDE ONLY
// Uses service role key, NEVER import in components
import { createClient } from '@supabase/supabase-js';
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
});
```

**When to use which:**
- **Components:** Always use `supabase` (limited permissions)
- **API routes:** Always use `supabaseAdmin` (full permissions)
- **Hooks:** Use `supabase` (client-side)
- **Scripts:** Use `supabaseAdmin` (server-side)

**Query Patterns:**

```typescript
// Single record
const { data, error } = await supabaseAdmin
  .from('table_name')
  .select('field1, field2')
  .eq('id', id)
  .single();

// Multiple records with join
const { data } = await supabaseAdmin
  .from('main_table')
  .select(`
    id,
    name,
    related_table:related_id (
      id,
      field
    )
  `)
  .order('created_at', { ascending: false });

// Upsert (insert or update)
const { error } = await supabaseAdmin
  .from('table')
  .upsert({ id, field }, { onConflict: 'id' });

// Transaction via RPC
const { error } = await supabaseAdmin.rpc('function_name', {
  param1: value1,
  param2: value2
});
```

### 2. Real-time Subscriptions

**Pattern: Realtime + Polling Fallback**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RealtimeComponent() {
  const [data, setData] = useState<Type[]>([]);

  // Load initial data via HTTP
  const loadData = async () => {
    const response = await fetch('/api/endpoint');
    const result = await response.json();
    setData(result.data);
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('unique-name')
      .on('postgres_changes',
        {
          event: '*',              // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
          schema: 'public',
          table: 'table_name',
          filter: 'id=eq.1'       // Optional filter
        },
        (payload) => {
          const { old, new: newData, eventType } = payload;

          if (eventType === 'INSERT') {
            setData(prev => [...prev, newData]);
          } else if (eventType === 'UPDATE') {
            setData(prev => prev.map(item =>
              item.id === newData.id ? newData : item
            ));
          } else if (eventType === 'DELETE') {
            setData(prev => prev.filter(item => item.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Polling fallback (for critical data)
  useEffect(() => {
    const interval = setInterval(loadData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return <div>{/* UI */}</div>;
}
```

**Realtime-enabled Tables:**
- `messages` (chat)
- `current_stream` (video state)
- `polls` (poll questions)
- `poll_votes` (poll responses)

### 3. Authentication

**Two-tier system:**

#### Admin Authentication (JWT)
```typescript
// 1. Login: POST /api/auth/admin-login
const response = await fetch('/api/auth/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin123' })
});

// 2. Server creates JWT token and sets httpOnly cookie
// Cookie: admin_session (8-hour expiration)

// 3. Protected routes check session
const session = await getAdminSession();
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// 4. Logout: POST /api/auth/admin-logout
// Clears cookie
```

#### Viewer Registration (localStorage)
```typescript
// 1. Register with display name (no password)
const viewer = {
  userId: `viewer_${Date.now()}_${Math.random().toString(36)}`,
  displayName: 'John Doe',
  email: 'john@example.com'
};
localStorage.setItem('after_party_viewer', JSON.stringify(viewer));

// 2. Retrieve viewer data
const viewerData = JSON.parse(
  localStorage.getItem('after_party_viewer') || '{}'
);
```

### 4. Rate Limiting

**Two implementations:**

```typescript
// Basic rate limiting (for auth)
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const identifier = request.ip || 'anonymous';
  const isAllowed = await checkRateLimit(identifier, 3, 60000); // 3/min

  if (!isAllowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  // ... handle request
}

// Enhanced rate limiting (middleware wrapper)
import { moderateRateLimit } from '@/lib/rate-limit-enhanced';

export async function POST(request: NextRequest) {
  return moderateRateLimit()(request, async (req) => {
    // Handler code here
    return NextResponse.json({ success: true });
  });
}

// Available presets:
// strictRateLimit()   - 10 requests/minute
// moderateRateLimit() - 30 requests/minute
// lenientRateLimit()  - 100 requests/minute
```

### 5. Video Synchronization

**⚠️ CRITICAL: Complex sync logic in `components/VideoPlayer.tsx`**

The video player uses **multiple mechanisms** to maintain sync:

1. **Realtime subscription** to `current_stream` table changes
2. **Periodic polling** (30s when healthy, 5s when degraded)
3. **Smart thresholds** to prevent jitter:
   - Playing: only seek if >5s off target
   - Paused: only seek if >2s off target
4. **Deduplication** via `lastSyncedState` tracking
5. **Tab visibility detection** (force sync when tab becomes visible)
6. **Circuit breaker** (stop after 5 consecutive failures)

**When modifying video sync:**
- Test with network throttling
- Test with tab hidden/visible
- Verify no restart loops
- Check that multiple clients stay in sync
- Test fallback to polling if Realtime fails

**Key state in `current_stream` table:**
```typescript
{
  playback_state: 'playing' | 'paused' | 'stopped',
  playback_position: number,        // Seconds
  playback_elapsed_ms: number,      // Milliseconds since last command
  last_playback_command: timestamp,
  last_command_id: uuid             // Deduplication key
}
```

### 6. Mux Integration

**Server-side (lib/mux.ts):**

```typescript
import Mux from '@mux/mux-node';
import { generatePlaybackToken } from '@/lib/mux';

// List assets
const mux = new Mux(tokenId, tokenSecret);
const assets = await mux.video.assets.list();

// Generate signed playback token (requires signing keys)
const token = await generatePlaybackToken(playbackId, {
  type: 'video',
  expiration: '1h'
});
```

**Client-side (components):**

```typescript
import MuxPlayer from '@mux/mux-player-react';

<MuxPlayer
  playbackId={playbackId}
  tokens={{ playback: token }}
  streamType={kind === 'live' ? 'live' : 'on-demand'}
  metadata={{
    video_title: title,
    viewer_user_id: viewerId
  }}
  accentColor="#9146FF"
/>
```

**Playback Token Refresh:**
- Tokens expire after 1 hour
- Use `useTokenRefresh` hook to auto-refresh before expiration
- Refresh 5 minutes before expiry

---

## Critical Gotchas

### ⚠️ 1. Two Supabase Clients

**NEVER import `supabaseAdmin` in client components!**

```typescript
// ❌ DANGEROUS - Exposes service role key in browser
'use client';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ✅ Correct - Use client-safe supabase
'use client';
import { supabase } from '@/lib/supabase';
```

### ⚠️ 2. Video Sync Restart Loops

**Problem:** Updates to `current_stream` broadcast to all clients, which can trigger sync loops.

**Solution:**
- Always check `lastSyncedState` before syncing
- Use `last_command_id` for deduplication
- Only seek if time difference exceeds threshold
- Implement circuit breaker after consecutive failures

**DO NOT:**
- Update `current_stream` on every player time update
- Sync without checking time difference threshold
- Broadcast position updates from viewers

### ⚠️ 3. Real-time Channel Cleanup

**ALWAYS clean up Realtime subscriptions:**

```typescript
useEffect(() => {
  const channel = supabase.channel('name').subscribe();

  // ✅ Must return cleanup function
  return () => supabase.removeChannel(channel);
}, []);
```

**Failing to cleanup causes:**
- Memory leaks
- Multiple subscriptions to same channel
- Duplicate event handlers

### ⚠️ 4. Rate Limiting on Admin Auth

**Admin login is rate-limited to 3 attempts per minute.**

When testing:
- Clear rate limit cache between tests
- Use different IPs for testing
- Wait 60 seconds between failed attempts

### ⚠️ 5. Session Secret Length

**SESSION_SECRET must be 32+ characters in production.**

```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ⚠️ 6. Mux Signing Keys Format

**Mux private keys must be in PKCS8 format:**

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----
```

**Common errors:**
- Wrong format (use PKCS8, not PKCS1)
- Line breaks removed (keep `\n` characters)
- Quoted incorrectly in .env file

### ⚠️ 7. RLS Policies

**Current setup allows public read/write.**

When adding new tables:
- Consider implementing RLS policies
- Test with anon key (client-side)
- Verify service role bypasses RLS

### ⚠️ 8. Environment Variables

**Public vs Private variables:**

```bash
# Public (sent to browser)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_EVENT_DATE=...

# Private (server-only)
SUPABASE_SERVICE_ROLE_KEY=...   # ⚠️ NEVER expose in client
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_SIGNING_KEY_PRIVATE=...
ADMIN_PASSWORD_HASH=...
SESSION_SECRET=...
```

---

## Common Tasks

### Task 1: Add a New API Endpoint

```typescript
// 1. Create file: app/api/resource/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate
    const { field } = await request.json();
    if (!field) {
      return NextResponse.json({ error: 'Missing field' }, { status: 400 });
    }

    // Database operation
    const { data, error } = await supabaseAdmin
      .from('table')
      .insert({ field })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// 2. Test with curl
// curl -X POST http://localhost:3000/api/resource \
//   -H "Content-Type: application/json" \
//   -d '{"field": "value"}'
```

### Task 2: Add a Real-time Component

```typescript
// 1. Create component: components/MyComponent.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Item {
  id: number;
  name: string;
}

export default function MyComponent() {
  const [items, setItems] = useState<Item[]>([]);

  // Load initial data
  useEffect(() => {
    async function load() {
      const response = await fetch('/api/items');
      const result = await response.json();
      setItems(result.data);
    }
    load();
  }, []);

  // Subscribe to changes
  useEffect(() => {
    const channel = supabase
      .channel('items-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new as Item]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}

// 2. Enable Realtime on table (if not already enabled)
// Run: npm run enable:realtime
// Or manually in Supabase dashboard: Database > Replication
```

### Task 3: Add a Database Table

```sql
-- 1. Create migration: sql/014_new_feature.sql
CREATE TABLE new_table (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (optional)
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policy (example: public read)
CREATE POLICY "Allow public read access"
  ON new_table FOR SELECT
  USING (true);

-- Enable Realtime (if needed)
ALTER PUBLICATION supabase_realtime ADD TABLE new_table;

-- 2. Run migration
-- Execute in Supabase SQL Editor or via setup script
```

### Task 4: Add Admin Action Logging

```typescript
// After any admin operation in an API route:
await supabaseAdmin.from('admin_actions').insert({
  action_type: 'operation_name',       // e.g., 'delete_message'
  admin_user: session.adminId || 'system',
  details: {                           // Any relevant data
    resource_id: id,
    changes: { field: 'value' }
  }
});
```

### Task 5: Update Environment Variables

```bash
# 1. Local development
# Edit .env.local (never commit this file)

# 2. Vercel deployment
# Settings > Environment Variables
# Add for: Production, Preview, Development

# 3. Docker deployment
# Update docker-compose.yml or pass via -e flags

# 4. Kubernetes deployment
# Edit helm/after-party/values.yaml
# Or create sealed secrets
```

### Task 6: Debug Real-time Issues

```typescript
// Add logging to see Realtime status
useEffect(() => {
  const channel = supabase
    .channel('debug-channel')
    .on('postgres_changes', { ... }, (payload) => {
      console.log('Realtime event:', payload);
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
      // SUBSCRIBED, CHANNEL_ERROR, CLOSED, TIMED_OUT
    });

  return () => supabase.removeChannel(channel);
}, []);

// Check Supabase dashboard: Database > Replication
// Verify table is enabled for Realtime
```

---

## Testing & Validation

### Quick Health Checks

```bash
# 1. Application health
curl http://localhost:3000/api/health

# Expected: {"status":"ok","timestamp":"...","service":"event-streaming-platform"}

# 2. Database connectivity
npm run test:supabase

# 3. Mux connectivity
npm run test:mux

# 4. Build check
npm run build

# 5. Lint check
npm run lint
```

### Manual Testing Checklist

**Before committing changes:**
- [ ] Application builds successfully (`npm run build`)
- [ ] No TypeScript errors
- [ ] No ESLint errors (`npm run lint`)
- [ ] Health endpoint returns 200
- [ ] Database operations work (read + write)
- [ ] Real-time subscriptions connect (check browser console)
- [ ] Video playback works (if touching video code)
- [ ] Admin auth works (if touching auth code)
- [ ] Rate limiting works (if applicable)
- [ ] No console errors in browser

**For video sync changes:**
- [ ] Test with network throttling (Chrome DevTools)
- [ ] Test with tab hidden/visible
- [ ] Test multiple viewers in sync
- [ ] Verify no restart loops
- [ ] Test Realtime disconnection (fallback to polling)

**For database changes:**
- [ ] Migration runs without errors
- [ ] RLS policies tested with anon key
- [ ] Realtime enabled if needed
- [ ] Indexes created for frequently queried columns

### Development Scripts

```bash
# Setup
npm install                    # Install dependencies
npm run setup:db              # Initialize database schema
npm run seed:demo             # Populate demo data
npm run enable:realtime       # Enable Realtime on tables

# Development
npm run dev                   # Start dev server (port 3000)

# Testing
npm run test:supabase         # Test Supabase connection
npm run test:mux              # Test Mux connection

# Build
npm run build                 # Production build
npm run start                 # Start production server
npm run lint                  # Run ESLint

# Utilities
npm run generate-admin-hash   # Hash admin password
```

### Debugging Tips

**1. Real-time not working:**
- Check Supabase dashboard: Database > Replication
- Verify table is enabled
- Check browser console for subscription status
- Test with `supabase.channel().subscribe((status) => console.log(status))`

**2. Video won't play:**
- Verify Mux playback ID is correct
- Check playback token is valid (not expired)
- Inspect browser console for player errors
- Test direct Mux URL: `https://stream.mux.com/{playbackId}.m3u8`

**3. Authentication fails:**
- Verify password hash matches (bcrypt)
- Check SESSION_SECRET is set and 32+ chars
- Clear cookies and try again
- Check rate limiting (wait 60s between attempts)

**4. Database errors:**
- Check connection string in .env.local
- Verify RLS policies allow operation
- Test with service role key (bypasses RLS)
- Check Supabase logs in dashboard

**5. Environment variables not loading:**
- Restart dev server after changing .env.local
- For `NEXT_PUBLIC_*` vars, rebuild app
- Check variable names match exactly (case-sensitive)

---

## Additional Resources

### Documentation Links
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Mux Docs](https://docs.mux.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Project-Specific Docs
- `README.md` - Setup and deployment guide
- `QUICK_MUX_SETUP.md` - Fast video setup
- `MUX_VIDEO_GUIDE.md` - Comprehensive video guide
- `VERCEL_DEPLOYMENT.md` - Production deployment
- `DEPLOYMENT_CHECKLIST.md` - Pre-deploy checklist
- `SYNC_FIX_SUMMARY.md` - Video sync implementation details
- `helm/README.md` - Kubernetes deployment

### Key Database Tables

| Table | Purpose | Realtime |
|-------|---------|----------|
| `current_stream` | Active video state (singleton) | ✅ Yes |
| `mux_items` | Video catalog | ❌ No |
| `video_queue` | Admin playlist | ❌ No |
| `messages` | Chat messages | ✅ Yes |
| `polls` | Poll questions | ✅ Yes |
| `poll_options` | Poll choices | ❌ No |
| `poll_votes` | Poll responses | ✅ Yes |
| `chat_throttle` | Rate limiting | ❌ No |
| `admin_actions` | Audit log | ❌ No |

### Environment Variables Reference

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...         # ⚠️ Server-only

# Mux (required)
MUX_TOKEN_ID=xxx
MUX_TOKEN_SECRET=xxx
MUX_SIGNING_KEY_ID=xxx
MUX_SIGNING_KEY_PRIVATE="-----BEGIN PRIVATE KEY-----\n..."

# Authentication (required)
ADMIN_PASSWORD_HASH=$2a$10$xxx...
VIEWER_PASSWORD_HASH=$2a$10$xxx...
SESSION_SECRET=xxx                            # 32+ chars

# App Config (required)
NEXT_PUBLIC_EVENT_DATE=2025-12-31T20:00:00Z
EVENT_ROOM_ID=main

# Optional
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Version History

| Date | Changes |
|------|---------|
| 2025-12-21 | Initial CLAUDE.md creation with comprehensive codebase analysis |

---

**Questions or need clarification?** Review the README.md and project documentation, or examine existing code patterns in similar files.
