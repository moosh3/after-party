# Product Requirements Document — Private Event Streaming Platform

## 1. Executive Summary

A lightweight web application for hosting single-use private streaming events with ~30 concurrent viewers. The platform combines Mux video infrastructure with real-time chat and interactive polling, enabling administrators to dynamically switch video content during live events.

**Key Differentiators:**
- Event-focused (ephemeral, single-day usage)
- Admin-controlled content switching without viewer disruption
- Integrated engagement tools (chat + polls)
- Privacy-first architecture with signed tokens and gated access

---

## 2. Goals & Success Metrics

### Primary Objectives
1. **Reliable Video Delivery:** Stream pre-recorded content with minimal buffering
2. **Real-Time Interaction:** Enable audience engagement through chat and polls
3. **Dynamic Content Control:** Allow admins to switch streams seamlessly
4. **Privacy Assurance:** Maintain event exclusivity through authentication and signed tokens

### Quantifiable Success Metrics
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time to First Frame (TTF) | < 3s | Client-side performance logging |
| Chat Message Delivery Rate | ≥ 99% | Server-side delivery confirmation |
| Stream Switch Latency | < 3s | Client polling/subscription lag |
| Deployment Time | < 2 hours | From repo clone to production |
| Zero Critical Failures | 100% | Event completes without service disruption |
| Concurrent User Support | 30 users | Load testing validation |

### Non-Goals
- Multi-tenant or SaaS functionality
- Long-term video storage/VOD libraries
- Mobile native applications
- Monetization features (ads, subscriptions, tipping)
- Advanced analytics beyond basic engagement metrics
- Live streaming encoder support (pre-recorded only for v1)

---

## 3. Target Audience & Context

### Primary Users
**Viewers (25-30 concurrent)**
- Invited guests with access credentials
- Modern browser users (last 2 major versions)
- Broadband connection (≥5 Mbps recommended)

**Administrator (1-2 users)**
- Event organizer with technical comfort
- Pre-event setup and live event management
- Post-event data review

### Usage Context
- **Event Duration:** 1-4 hours (single session)
- **Preparation Time:** 24-48 hours before event
- **Post-Event:** 7-day data retention, then purge
- **Typical Use Cases:** Private premieres, corporate town halls, invite-only webinars

---

## 4. User Stories & Workflows

### Viewer Journey
```
1. Receive invitation link via email/message
2. Access /event → Authenticate with password/magic link
3. Wait in lobby (optional countdown/message)
4. Video begins → HLS player loads with signed token
5. Engage in chat and participate in polls
6. Admin switches content → Seamless transition to new video
7. Event concludes → Access revoked after 24 hours
```

**Key User Stories:**
- As a viewer, I want to join without complex registration so I can access content quickly
- As a viewer, I want chat messages to appear instantly so I feel connected to other attendees
- As a viewer, I want to vote in polls once so my voice is heard without spam
- As a viewer, I want the video to adapt to my bandwidth so playback remains smooth

### Administrator Journey
```
1. Pre-Event Setup:
   - Upload videos to Mux (or use existing playback IDs)
   - Configure event access credentials
   - Test stream switching and polling
   
2. During Event:
   - Monitor viewer count and chat activity
   - Switch between video segments as planned
   - Launch polls at strategic moments
   - Close polls and share results
   
3. Post-Event:
   - Review chat logs and poll results
   - Export data if needed
   - Archive or delete event data
```

**Key User Stories:**
- As an admin, I want to switch videos without viewers needing to refresh so transitions feel professional
- As an admin, I want to create polls in under 30 seconds so I can respond to live dynamics
- As an admin, I want to see vote counts in real-time so I can time poll closures appropriately
- As an admin, I want simple authentication so I can focus on the event, not tech issues

---

## 5. Functional Requirements

### 5.1 Authentication & Access Control

**Viewer Authentication**
- **Option A (Password):** Single shared password for event access
  - Hash stored in environment variable
  - Cookie/session valid for 24 hours
  - Logout clears session
- **Option B (Magic Link):** Pre-generated unique tokens
  - One-time use or session-bound
  - Expires after event + 24 hours
  
**Admin Authentication**
- Separate admin password (stronger than viewer password)
- Admin session expires after 8 hours of inactivity
- All admin actions logged with timestamp

**Security Requirements**
- Rate limiting on auth endpoints (5 attempts per IP per minute)
- HTTPS-only (enforced via Vercel)
- No password transmission in URLs
- Session tokens use httpOnly, secure, sameSite cookies

### 5.2 Video Playback

**Core Functionality**
- HLS.js player for cross-browser compatibility
- Adaptive bitrate streaming (ABR) via Mux
- Signed Mux tokens with 1-hour expiry (auto-refresh at 50 minutes)
- Support for both VOD and live Mux assets

**Player Features**
- Play/pause controls
- Volume control and muting
- Fullscreen support
- Quality selector (auto/720p/1080p)
- Playback speed adjustment (0.5x - 2x)
- Keyboard shortcuts (spacebar, arrow keys)

**Error Handling**
- Graceful degradation if token expires
- Retry logic for network failures (3 attempts with exponential backoff)
- User-friendly error messages
- Automatic quality downgrade on bandwidth issues

**Technical Specifications**
- Token refresh: Client checks token expiry every 30s
- Buffer target: 10 seconds
- Max buffer: 30 seconds
- Seek support: Yes (for VOD assets)

### 5.3 Stream Management

**Current Stream API**
```
GET /api/current
Response: {
  playbackId: string,
  title: string,
  token: string (JWT),
  expiresAt: timestamp,
  kind: 'vod' | 'live'
}
Cache-Control: no-cache, no-store
```

**Update Mechanism**
- **Default:** Client polls every 3 seconds
- **Enhanced:** Supabase Realtime subscription (fallback to polling)
- On stream change: Player switches source without full reload
- Preserve playback position if same content

**Admin Stream Control**
```
POST /api/admin/set-current
Body: {
  playbackId: string,
  title: string
}
Auth: Admin session required
Response: { success: boolean, updatedAt: timestamp }
```

### 5.4 Chat System

**Message Structure**
- User ID (anonymous or authenticated)
- Display name (auto-generated or custom)
- Message body (1-600 characters, sanitized)
- Timestamp (server-side)
- Message type: 'user', 'system', 'poll'

**Chat Features**
- Real-time delivery via Supabase Realtime
- Auto-scroll to latest message (disable on manual scroll)
- Display user count in chat header
- System messages for key events (stream change, poll creation)
- Optional emoji support (:smile: → 😊)

**Rate Limiting**
- Per-user: 1 message per 2 seconds
- Enforced at both client and server
- Client shows countdown timer before next message allowed
- Rate limit state stored in `chat_throttle` table

**Moderation (Optional)**
- Client-side word filter (customizable blocklist)
- Blocked messages replaced with "[Message removed]"
- Admin can manually delete messages (soft delete, audit retained)

**API Endpoints**
```
POST /api/chat/send
Body: { room: string, userName: string, body: string }
Response: { id: string, createdAt: timestamp }

GET /api/chat/messages?room=event&limit=100
Response: { messages: Message[] }
```

### 5.5 Polling System

**Poll Creation**
```
POST /api/admin/polls/create
Body: {
  room: string,
  question: string,
  options: string[] (2-5 options)
}
Response: { pollId: uuid, systemMessageId: string }
```

**Poll Display**
- Appears as special message type in chat
- Question prominently displayed
- Options as clickable buttons
- Shows vote count (live updates)
- Visual indicator for user's selected option
- "Poll Closed" state when inactive

**Voting Logic**
- One vote per user per poll
- Vote can be changed before poll closes
- Last vote overwrites previous selection
- Votes recorded in `poll_votes` table

**Poll Management**
```
POST /api/admin/polls/close
Body: { pollId: uuid }
Effect: Sets is_open = false, prevents new votes

GET /api/admin/polls/results?pollId=uuid
Response: {
  question: string,
  options: { label: string, votes: number, percentage: number }[],
  totalVotes: number
}
```

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Framework | Next.js 14+ (App Router) | Server components, API routes, edge deployment |
| Video Player | HLS.js 1.5+ | Cross-browser HLS support, ABR |
| Video Infrastructure | Mux | Reliable encoding, signed tokens, CDN |
| Database | Supabase (PostgreSQL) | Real-time subscriptions, RLS policies |
| Hosting | Vercel | Zero-config deployment, edge network |
| Styling | Tailwind CSS | Rapid UI development |
| Auth | Cookie-based sessions | Simple, secure for small scale |

### 6.2 Database Schema

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

-- Mux asset catalog (optional, for admin UI)
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
  deleted_at timestamptz,
  INDEX idx_messages_room_created (room, created_at DESC)
);

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
```

**Row-Level Security (RLS) Policies:**
- All tables: Viewer clients can only read
- `messages`, `poll_votes`: Authenticated users can insert (with rate limits)
- `current_stream`, `polls`: Only server-side API can modify
- Admin actions: Logged automatically via triggers

### 6.3 API Design

**Viewer Endpoints (Public with Auth)**
```
GET  /api/current              → Current stream info + signed token
POST /api/chat/send            → Send chat message
GET  /api/chat/messages        → Recent messages (100 most recent)
POST /api/polls/vote           → Submit poll vote
GET  /api/polls/:id/results    → Poll results (if closed)
```

**Admin Endpoints (Admin Auth Required)**
```
POST /api/admin/login          → Authenticate admin
POST /api/admin/set-current    → Change active stream
POST /api/admin/polls/create   → Create new poll
POST /api/admin/polls/close    → Close poll
GET  /api/admin/stats          → Viewer count, message count, poll summary
POST /api/admin/messages/delete → Soft-delete message
```

**Webhook Endpoints (Mux → Server)**
```
POST /api/webhooks/mux         → Handle asset.ready, asset.errored events
```

### 6.4 Mux Token Signing

**Implementation:**
```javascript
import Mux from '@mux/mux-node';

function generatePlaybackToken(playbackId, type = 'video') {
  const token = Mux.JWT.signPlaybackId(playbackId, {
    keyId: process.env.MUX_SIGNING_KEY_ID,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE,
    expiration: '1h',
    type: type, // 'video', 'thumbnail', 'storyboard'
    params: {
      // Optional DRM params
    }
  });
  return token;
}
```

**Token Refresh Strategy:**
- Initial token issued on page load
- Client monitors token expiry (stored in state)
- At 50 minutes, client calls `/api/current` to get fresh token
- Player updates source URL without interrupting playback

### 6.5 Real-Time Updates

**Supabase Realtime Configuration:**
```javascript
// Client-side subscription
const channel = supabase.channel('event-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'current_stream'
  }, (payload) => {
    // Fetch new stream info and update player
  })
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    // Append new message to chat
  })
  .subscribe();
```

**Fallback Polling:**
- If Realtime connection fails, fall back to 3-second polling
- Client detects disconnect and switches modes automatically

---

## 7. User Interface Design

### 7.1 Layout Structure

**Desktop (≥1024px)**
```
┌─────────────────────────────────────────┐
│  [Event Title]              [User: 30]  │
├─────────────────────┬───────────────────┤
│                     │   CHAT            │
│                     │   ┌─────────────┐ │
│   VIDEO PLAYER      │   │ User1: Hi!  │ │
│   (16:9 aspect)     │   │ User2: ...  │ │
│                     │   │ [POLL]      │ │
│                     │   └─────────────┘ │
│                     │   [Type message]  │
└─────────────────────┴───────────────────┘
     70% width             30% width
```

**Mobile (≤768px)**
```
┌───────────────┐
│ [Event Title] │
├───────────────┤
│  VIDEO        │
│  (16:9)       │
├───────────────┤
│ [Chat] [Info] │  ← Tabs
├───────────────┤
│ Chat messages │
│ scrollable    │
│               │
└───────────────┘
```

### 7.2 Component Specifications

**Video Player Component**
- Aspect ratio: 16:9 (responsive)
- Controls: Overlay on hover/tap
- Loading state: Spinner with "Loading video..."
- Error state: "Unable to load video" + retry button
- Quality badge: Shows current resolution (e.g., "1080p")

**Chat Component**
- Auto-scroll when at bottom, manual scroll disables auto
- Message timestamp: Relative (e.g., "2m ago")
- User avatar: Generated from first letter of name
- Rate limit indicator: "You can send another message in 2s"
- Empty state: "No messages yet. Start the conversation!"

**Poll Component (within chat)**
- Rounded card with accent background
- Question in bold, larger font
- Option buttons: Full width, show vote % after voting
- Closed state: Disabled buttons, show "Poll Closed"
- Results: Bar chart visualization (optional)

**Admin Panel**
- Sidebar navigation: Dashboard, Stream Control, Polls, Logs
- Stream switcher: Dropdown or manual playback ID input
- Poll creator: Question input + dynamic option inputs (2-5)
- Real-time stats: Active viewers, total messages, active polls

### 7.3 Design System

**Color Palette**
- Primary: #2563eb (blue-600)
- Secondary: #64748b (slate-500)
- Success: #10b981 (green-500)
- Error: #ef4444 (red-500)
- Background: #0f172a (slate-900) or #ffffff (light mode)
- Surface: #1e293b (slate-800) or #f8fafc (light mode)

**Typography**
- Headings: Inter, 600 weight
- Body: Inter, 400 weight
- Monospace: JetBrains Mono (for playback IDs)

**Spacing**
- Base unit: 4px (Tailwind default)
- Component padding: 4-6 units (16-24px)
- Section gaps: 6-8 units (24-32px)

---

## 8. Security & Privacy

### 8.1 Authentication Security

**Password Requirements**
- Viewer password: Minimum 8 characters (shared secret)
- Admin password: Minimum 12 characters, complexity enforced
- Stored as bcrypt hash with cost factor 12

**Session Management**
- Secure, httpOnly, sameSite=strict cookies
- CSRF protection via SameSite and optional tokens
- Session rotation on admin login

**Rate Limiting**
- Auth endpoints: 5 attempts/minute per IP (via Vercel middleware)
- Chat send: 1 message/2 seconds per user (DB-enforced)
- Poll vote: 1 vote per poll per user (DB constraint)
- API endpoints: 100 requests/minute per IP (general)

### 8.2 Video Security

**Mux Signed URLs**
- All playback requests require JWT token
- Tokens expire after 1 hour
- Signing key stored in environment variables (never client-exposed)
- Token includes playback policy ID for access control

**Domain Restriction**
- Configure Mux playback policy to allow only production domain
- Prevents hotlinking and unauthorized embedding

### 8.3 Data Privacy

**User Data Collection**
- Minimal: User ID (generated), display name, chat messages
- No email, IP logging (beyond rate limiting), or tracking cookies
- Clear data retention policy communicated to viewers

**Data Retention**
- Event data deleted 7 days after event conclusion
- Option for admin to export chat/poll data before deletion
- Anonymized analytics retained (viewer count, message count)

**Compliance Considerations**
- GDPR: Provide data export, right to deletion (via admin)
- CCPA: Privacy policy disclosure (if applicable)
- ToS: Clearly state event recording policy if applicable

### 8.4 Content Security

**Input Sanitization**
- All user inputs escaped/sanitized before rendering
- XSS prevention via React's default escaping + DOMPurify for rich content
- SQL injection prevention via parameterized queries (Supabase client)

**Content Security Policy (CSP)**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  media-src 'self' https://stream.mux.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  img-src 'self' data: https:;
```

---

## 9. Performance & Scalability

### 9.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Page Load (FCP) | < 1.5s | Lighthouse |
| Time to First Frame (TTF) | < 3s | Custom logging |
| Chat Message Latency | < 500ms | Server timestamp vs client render |
| Stream Switch Latency | < 3s | Client timing measurement |
| Lighthouse Score | ≥ 90 | Automated testing |

### 9.2 Optimization Strategies

**Frontend**
- Next.js static generation for /event page shell
- Code splitting: Player and chat components lazy-loaded
- Image optimization: Next.js Image component for static assets
- Font optimization: Variable font with subset characters

**Video Delivery**
- Mux adaptive bitrate streaming (auto quality adjustment)
- Preload metadata only (not full video)
- Placeholder thumbnail during loading
- Smart buffer management (10s target, 30s max)

**Database**
- Indexed queries on `messages.room` and `messages.created_at`
- Limit chat history to 100 most recent messages on load
- Paginated message loading for history (if needed)
- Connection pooling via Supabase (default)

**Caching**
- `/api/current`: No caching (dynamic)
- Static assets: 1-year cache with versioned filenames
- API responses: ETag-based revalidation where applicable

### 9.3 Scalability Analysis

**Current Architecture (30 viewers)**
- Video bandwidth: 30 × 4 Mbps = 120 Mbps (Mux CDN handles easily)
- API requests: 30 × (1/3s polling) = 10 RPS (negligible for Vercel)
- Database connections: 30 Realtime + 1-2 admin = 32 concurrent (well within Supabase free tier)
- Chat throughput: Assume 1 msg/user/minute = 0.5 writes/s (trivial)

**Scaling to 100 viewers (hypothetical)**
- Video: No change (CDN scales transparently)
- API: 33 RPS for polling (still negligible)
- Database: 100 Realtime connections (consider Supabase Pro)
- Cost: Minimal increase (Mux charges per viewer-hour, Supabase Pro if needed)

**Bottleneck Identification**
- Unlikely at 30 viewers
- At 500+ viewers: Consider dedicated Supabase instance or Redis for Realtime
- At 1000+ viewers: May need rate limiting adjustments and CDN for API routes

---

## 10. Testing Strategy

### 10.1 Unit Testing
- **Scope:** Utility functions (token signing, sanitization, validation)
- **Framework:** Jest + React Testing Library
- **Target:** 80% code coverage on critical paths
- **Examples:**
  - Token generation produces valid JWT
  - Message sanitization removes XSS vectors
  - Rate limit calculation correctly throttles

### 10.2 Integration Testing
- **Scope:** API routes, database interactions
- **Framework:** Jest + Supertest
- **Key Tests:**
  - `/api/current` returns valid playback token
  - `/api/chat/send` enforces rate limiting
  - `/api/admin/set-current` updates stream atomically
  - Poll creation inserts options correctly

### 10.3 End-to-End Testing
- **Framework:** Playwright
- **Critical Flows:**
  1. Viewer authentication → video playback
  2. Send chat message → appears for all users
  3. Admin switches stream → viewer sees new content
  4. Create poll → viewers vote → results update
- **Browsers:** Chrome, Firefox, Safari (desktop + mobile)

### 10.4 Performance Testing
- **Tool:** Lighthouse CI (automated on PR)
- **Targets:** All performance targets from Section 9.1
- **Load Testing:** Artillery or k6 for API endpoints
  - Simulate 30 concurrent viewers
  - Measure response times under load
  - Verify rate limiting enforces correctly

### 10.5 Security Testing
- **Manual Checks:**
  - Attempt to access admin routes without auth
  - Try SQL injection in chat messages
  - Test XSS payloads in username and message body
  - Verify token expiry enforces correctly
- **Automated:** OWASP ZAP scan on staging environment

### 10.6 User Acceptance Testing (UAT)
- **Participants:** 5-10 beta testers (not part of core team)
- **Timing:** 48 hours before live event
- **Checklist:**
  - Can access event without technical issues
  - Video plays smoothly on their device/connection
  - Chat feels responsive and intuitive
  - Polls work as expected
  - Overall experience feels polished

---

## 11. Deployment & Operations

### 11.1 Environment Configuration

**Development**
- Local Next.js server (`npm run dev`)
- Supabase local instance or dev project
- Mux test environment (if available)

**Staging**
- Vercel preview deployment (PR-based)
- Supabase staging project
- Mux production environment (non-public assets)
- URL: `event-staging-xyz.vercel.app`

**Production**
- Vercel production deployment
- Supabase production project
- Mux production environment
- Custom domain (optional): `event.yourdomain.com`

### 11.2 Environment Variables

**Required for All Environments:**
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
NEXT_PUBLIC_EVENT_DATE=
EVENT_ROOM_ID=event
```

### 11.3 Deployment Process

**Pre-Deployment Checklist:**
- [ ] All environment variables configured in Vercel
- [ ] Database migrations applied to production Supabase
- [ ] Mux assets uploaded and playback IDs recorded
- [ ] Admin credentials tested
- [ ] Vercel domain configured (if custom)
- [ ] CSP headers configured in `next.config.js`

**Deployment Steps:**
1. Merge feature branch to `main`
2. Vercel auto-deploys to production
3. Run smoke tests on production URL
4. Verify admin panel access
5. Test sample stream playback
6. Announce event URL to attendees

**Rollback Plan:**
- Vercel instant rollback to previous deployment
- Database rollback via Supabase dashboard (if migrations)
- DNS switch if custom domain issues

### 11.4 Monitoring & Observability

**Application Monitoring**
- Vercel Analytics: Page views, request counts, error rates
- Custom logging: Winston or Pino for structured logs
- Client-side error tracking: Sentry (optional)

**Key Metrics to Monitor:**
- Active viewer count (real-time)
- Video playback errors (client-side logs)
- API response times (Vercel dashboard)
- Chat message rate (messages per minute)
- Database connection pool usage (Supabase dashboard)

**Alerting (Optional for 30-viewer event)**
- Vercel Slack integration for deployment notifications
- Email alert if > 5 API errors in 5 minutes
- Manual check of Vercel dashboard during event

**Logging Strategy**
- Info: Stream changes, poll creation/closure
- Warn: Rate limit hits, token refresh failures
- Error: Playback errors, API failures, auth failures
- Retention: 7 days (aligned with data retention)

### 11.5 Disaster Recovery

**Scenario: Vercel Outage**
- Mitigation: None (acceptable risk for ephemeral event)
- Communication: Notify attendees via backup channel (email/SMS)

**Scenario: Supabase Realtime Failure**
- Fallback: Client auto-switches to polling mode
- Impact: Slight latency increase (3s vs instant)

**Scenario: Mux Playback Failure**
- Mitigation: Prepare backup Mux asset (different playback ID)
- Admin action: Switch to backup via admin panel
- Worst case: Host on Vimeo/YouTube as emergency fallback

**Scenario: Invalid Mux Token**
- Prevention: Test token generation in staging 24h prior
- Mitigation: Manual token refresh endpoint for admin
- Impact: Temporary playback interruption (< 30s)

---

## 12. Timeline & Milestones

### Development Phases (5-Day Sprint)

**Day 1: Foundation (6-8 hours)**
- [ ] Initialize Next.js project with TypeScript and Tailwind
- [ ] Set up Supabase project and create database schema
- [ ] Configure Mux account and generate signing keys
- [ ] Implement basic authentication (viewer password)
- [ ] Deploy to Vercel staging
- **Deliverable:** Authenticated /event page with placeholder UI

**Day 2: Core Features (6-8 hours)**
- [ ] Implement video player with HLS.js
- [ ] Create `/api/current` endpoint with Mux token signing
- [ ] Build stream switching logic (client polls every 3s)
- [ ] Create admin panel with login
- [ ] Implement admin stream control (set current playback ID)
- **Deliverable:** Working video playback with admin control

**Day 3: Chat System (6-8 hours)**
- [ ] Build chat UI component
- [ ] Implement `/api/chat/send` endpoint with rate limiting
- [ ] Set up Supabase Realtime subscriptions for messages
- [ ] Add chat message display and auto-scroll
- [ ] Implement fallback polling if Realtime fails
- **Deliverable:** Functional real-time chat

**Day 4: Polling System (6-8 hours)**
- [ ] Create poll data model and API endpoints
- [ ] Build poll creation UI in admin panel
- [ ] Implement poll display component (inline in chat)
- [ ] Add voting functionality with one-vote constraint
- [ ] Build poll closure and results display
- **Deliverable:** Complete polling feature

**Day 5: Polish & QA (6-8 hours)**
- [ ] Refine UI/UX (responsive design, loading states, errors)
- [ ] Add token auto-refresh logic
- [ ] Implement CSP headers and security hardening
- [ ] Run full test suite (unit, integration, E2E)
- [ ] Perform cross-browser testing
- [ ] Load test with simulated 30 viewers
- [ ] Deploy to production and final smoke test
- **Deliverable:** Production-ready application

### Pre-Event Preparation (T-48 to T-0 hours)

**T-48 Hours: Content Upload**
- Upload all video content to Mux
- Record playback IDs in admin panel or `.env`
- Test playback of each video

**T-24 Hours: Dry Run**
- Invite 5-10 beta testers to staging environment
- Run through complete event flow (authentication → video → chat → polls)
- Verify admin stream switching works smoothly
- Test on multiple devices and browsers
- Document any issues and deploy fixes

**T-12 Hours: Final Checks**
- Set initial stream in production database
- Test production authentication
- Verify all environment variables are correct
- Prepare backup communication channel (email list, phone tree)
- Brief admin on troubleshooting steps

**T-2 Hours: Go-Live Preparation**
- Admin logs into admin panel
- Verify viewer count shows "0"
- Send event link to attendees
- Monitor Vercel dashboard for traffic

**T-0: Event Start**
- Admin switches to "live" stream when ready
- Monitor viewer count and chat activity
- Launch polls at planned intervals
- Switch streams as per event schedule

---

## 13. Risk Management

### 13.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation | Contingency |
|------|-----------|--------|------------|-------------|
| **Mux token configuration error** | Low | Critical | Test in staging 48h prior; document exact steps | Manual token generation script; fallback to public playback (emergency only) |
| **Supabase Realtime connection failure** | Low | Medium | Auto-fallback to polling implemented | Already built into architecture |
| **High rate of playback errors** | Medium | High | Cross-browser testing; provide system requirements to viewers | Reduce video quality via Mux; provide troubleshooting guide |
| **Chat spam/abuse** | Medium | Low | Rate limiting + optional word filter | Admin can delete messages; worst case disable chat |
| **Admin locked out during event** | Low | High | Multiple admin accounts; password recovery mechanism | Emergency admin credentials stored offline; database direct access |
| **Vercel deployment failure** | Very Low | Critical | Test deployments; maintain previous working version | Instant rollback to previous deployment |
| **Database connection exhaustion** | Very Low | High | Monitor connection pool; 30 viewers well within limits | Restart connections via Supabase dashboard |
| **Token expiry during event** | Low | Medium | Auto-refresh at 50 minutes; tested in dry run | Manual refresh button in player UI |

### 13.2 Operational Risks

| Risk | Likelihood | Impact | Mitigation | Contingency |
|------|-----------|--------|------------|-------------|
| **Wrong stream loaded at start** | Medium | Medium | Pre-set correct stream; admin checklist | Admin switches immediately; < 30s impact |
| **Admin unavailable during event** | Low | High | Two admin accounts; train backup admin | Pre-schedule all content switches; minimize manual intervention |
| **Viewer link leaked publicly** | Medium | Medium | Unique passwords; monitor viewer count | Regenerate password; notify legitimate attendees |
| **Content not uploaded to Mux** | Low | Critical | 48-hour upload deadline; verify all assets | Have source files ready; emergency upload takes ~10 min for SD |
| **Timezone confusion for attendees** | Medium | Low | Clearly communicate timezone; countdown timer | Send reminder 1 hour before with "starting in X minutes" |

### 13.3 User Experience Risks

| Risk | Likelihood | Impact | Mitigation | Contingency |
|------|-----------|--------|------------|-------------|
| **Autoplay blocked by browser** | High | Medium | User education; "Click to start" overlay | Acceptable UX pattern; common across web video |
| **Poor network conditions for viewers** | Medium | Medium | ABR streaming; recommend 5+ Mbps connection | Mux auto-downgrades quality; provide tech support contact |
| **Chat overload (too many messages)** | Low | Low | 30 users unlikely to overwhelm; rate limiting | Increase rate limit buffer; acceptable for short event |
| **Polls close too quickly** | Medium | Low | Admin monitors vote count; recommended minimum 2 minutes | Reopen poll via database if needed; announce extension |
| **Confusion about event status** | Medium | Low | Countdown timer; "Event starting soon" message | System message in chat; admin announcement |

---

## 14. Success Criteria & Acceptance

### 14.1 Launch Readiness Checklist

**Technical Prerequisites:**
- [ ] All video content uploaded to Mux (48h before event)
- [ ] Database schema deployed to production Supabase
- [ ] Environment variables configured and tested in production
- [ ] Admin panel accessible with correct credentials
- [ ] Viewer authentication working (correct password hash)
- [ ] Test stream loads and plays in production environment
- [ ] Chat sends and receives messages in real-time
- [ ] Poll creation and voting functional
- [ ] Stream switching works without page reload
- [ ] Cross-browser testing completed (Chrome, Firefox, Safari, iOS Safari)
- [ ] Performance benchmarks met (Lighthouse score ≥ 90, TTF < 3s)
- [ ] Security scan completed (no critical vulnerabilities)

**Operational Prerequisites:**
- [ ] Dry run completed successfully with beta testers
- [ ] Admin trained on all features (stream switch, poll creation, troubleshooting)
- [ ] Backup admin identified and granted access
- [ ] Event schedule documented (when to switch streams, launch polls)
- [ ] Attendee list finalized and invitations sent
- [ ] Backup communication channel established (email/SMS list)
- [ ] Monitoring dashboard accessible (Vercel, Supabase)
- [ ] Incident response plan documented and shared

### 14.2 Post-Event Success Metrics

**Must-Have (Critical Success Factors):**
- Zero critical failures (event completes without service interruption)
- Video playback success rate ≥ 95% (playback errors logged)
- Average TTF ≤ 3 seconds (measured client-side)
- Stream switch latency ≤ 3 seconds (admin timestamp to client update)
- Chat message delivery rate ≥ 99% (server confirmation vs. client render)

**Should-Have (Quality Indicators):**
- Peak concurrent viewers within expected range (25-35)
- Chat engagement rate ≥ 40% (viewers who send at least one message)
- Poll participation rate ≥ 60% (voters per total viewers)
- Zero admin-reported operational issues
- Positive feedback from 80% of surveyed attendees (optional post-event survey)

**Nice-to-Have (Delight Factors):**
- Page load time (FCP) ≤ 1.5 seconds
- Zero chat spam or abuse reports
- Admin reported ease-of-use rating ≥ 4/5
- Attendees request access to recording or future events

### 14.3 Post-Event Review

**Immediate (Within 24 Hours):**
- Review Vercel logs for errors and warnings
- Check Supabase database for anomalies (failed inserts, timeouts)
- Survey admin for operational feedback
- Document any incidents or deviations from plan

**Within 7 Days:**
- Export chat logs and poll results (if requested)
- Optional attendee survey (satisfaction, technical issues, feature requests)
- Compile metrics report (viewer count, message count, poll participation)
- Conduct retrospective with development team

**Retrospective Questions:**
- What worked well technically?
- What operational challenges arose?
- What would we change for future events?
- Is this architecture suitable for larger audiences (50, 100+ viewers)?
- What features would add most value in v2?

---

## 15. Future Enhancements (Post-v1)

### Priority 1 (High Impact, Low Effort)

**Real-Time Stream Updates (Replace Polling)**
- Replace 3-second polling with Supabase Realtime for stream changes
- Reduces latency from 3s average to < 500ms
- Already supported by infrastructure, requires client refactor
- **Effort:** 2-4 hours

**Emoji Reactions**
- Add reaction buttons (👍 ❤️ 😂 🎉) to video player
- Display floating emoji animations on viewer screens
- Store aggregated counts in database
- **Effort:** 4-6 hours

**Pinned Messages**
- Admin can pin important messages to top of chat
- Useful for announcements, links, instructions
- Persists until unpinned or event ends
- **Effort:** 3-4 hours

**Magic Link Authentication**
- Replace shared password with unique per-attendee links
- Improves security and attendance tracking
- Requires email capture and SendGrid/Resend integration
- **Effort:** 6-8 hours

### Priority 2 (High Impact, Medium Effort)

**Advanced Moderation Tools**
- Keyword auto-filter with customizable blocklist
- Slow mode (minimum time between messages, global)
- User timeout/ban functionality
- Message history view with bulk delete
- **Effort:** 8-12 hours

**Lobby/Countdown Timer**
- Pre-event landing page with countdown
- "Event starting in X minutes" display
- Auto-redirect when event begins
- Optional background music or teaser video
- **Effort:** 4-6 hours

**Enhanced Poll Features**
- Multiple choice polls (select 2+ options)
- Open-ended text responses
- Anonymous vs. identified voting toggle
- Export poll results to CSV
- **Effort:** 6-10 hours

**Viewer Analytics Dashboard**
- Peak concurrent viewers graph
- Geographic distribution (if IP logged)
- Device/browser breakdown
- Average watch time and engagement metrics
- **Effort:** 8-12 hours

**Recording/Replay Functionality**
- Save event stream and chat for 7-day replay
- Time-synced chat playback with video
- Admin can publish replay link post-event
- **Effort:** 10-15 hours

### Priority 3 (Lower Priority or Experimental)

**Multiple Room Support**
- Host breakout sessions or parallel tracks
- Viewers can switch between rooms
- Separate chat per room
- **Effort:** 15-20 hours (significant architectural change)

**Mobile Native Apps**
- React Native iOS/Android apps
- Better full-screen experience and notifications
- Requires separate release process
- **Effort:** 40-60 hours per platform

**Interactive Q&A Mode**
- Viewers submit questions, upvote others
- Admin/moderator selects questions to answer
- Optional live audio/video for selected questioners
- **Effort:** 20-30 hours

**Third-Party Integrations**
- Zapier/webhooks for event notifications
- Slack bot for admin monitoring
- Calendar invites with .ics file generation
- **Effort:** Variable (5-15 hours per integration)

**Advanced Video Features**
- Picture-in-picture (PiP) support
- Multi-angle/camera switching (if content supports)
- Live closed captions (via Mux)
- DVR/rewind functionality
- **Effort:** Variable (3-10 hours per feature)

---

## 16. Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **ABR** | Adaptive Bitrate streaming; automatically adjusts video quality based on viewer's bandwidth |
| **HLS** | HTTP Live Streaming; Apple's streaming protocol supported across browsers via HLS.js |
| **LL-HLS** | Low-Latency HLS; reduces stream delay to 3-5 seconds vs. 10-30s for standard HLS |
| **Mux** | Video infrastructure platform providing encoding, hosting, and CDN delivery |
| **Playback ID** | Unique identifier for a Mux video asset used in streaming URLs |
| **RLS** | Row-Level Security; Supabase/PostgreSQL feature for database access control |
| **TTF** | Time to First Frame; metric measuring how quickly video begins playback |
| **VOD** | Video on Demand; pre-recorded content (vs. live streaming) |
| **JWT** | JSON Web Token; secure, signed token for authentication and authorization |
| **CSP** | Content Security Policy; HTTP header preventing XSS and injection attacks |

### B. Environment Setup Guide

**Step 1: Clone Repository**
```bash
git clone https://github.com/yourorg/event-platform.git
cd event-platform
npm install
```

**Step 2: Configure Supabase**
1. Create project at supabase.com
2. Run database migrations from `/sql/schema.sql`
3. Enable Realtime for `current_stream` and `messages` tables
4. Copy anon key and service role key

**Step 3: Configure Mux**
1. Sign up at mux.com
2. Create signing key pair (Settings → Signing Keys)
3. Note key ID and private key
4. Upload test video to get playback ID

**Step 4: Set Environment Variables**
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

**Step 5: Generate Password Hashes**
```bash
npm run generate-hash "your-viewer-password"
npm run generate-hash "your-admin-password"
# Copy output to .env.local
```

**Step 6: Start Development Server**
```bash
npm run dev
# Open http://localhost:3000
```

### C. Troubleshooting Guide

**Issue: Video won't play**
- **Check:** Browser console for HLS.js errors
- **Verify:** Playback ID is correct in database
- **Test:** Mux token signature by calling `/api/current` directly
- **Try:** Different browser (Safari has native HLS support)
- **Confirm:** Mux playback policy allows your domain

**Issue: Chat messages not appearing**
- **Check:** Supabase Realtime status in browser console
- **Verify:** Database RLS policies allow inserts
- **Test:** Direct database insert via Supabase dashboard
- **Fallback:** Refresh page to force reconnection
- **Confirm:** CORS settings allow Supabase connection

**Issue: Admin can't switch streams**
- **Check:** Admin authentication cookie is valid
- **Verify:** Playback ID exists in `mux_items` table
- **Test:** Manual database update via Supabase dashboard
- **Confirm:** API route logs show request reached server

**Issue: Polls not working**
- **Check:** Poll record exists in `polls` table with `is_open = true`
- **Verify:** Options exist in `poll_options` table
- **Test:** Direct vote insert via Supabase dashboard
- **Confirm:** User hasn't already voted (check `poll_votes`)

**Issue: High latency on stream switches**
- **Measure:** Actual latency with browser DevTools Network tab
- **Check:** Polling interval (should be 3s)
- **Upgrade:** Switch from polling to Realtime subscriptions
- **Verify:** No network throttling or firewalls blocking requests

### D. Admin Quick Reference

**Stream Switching**
1. Log in to `/admin`
2. Navigate to "Stream Control"
3. Select stream from dropdown or paste playback ID
4. Click "Make Current"
5. Verify change on viewer page (open in incognito window)

**Creating a Poll**
1. Navigate to "Polls" in admin panel
2. Enter question (max 300 characters)
3. Add 2-5 options (max 100 characters each)
4. Click "Create Poll"
5. Poll appears immediately in chat for all viewers

**Closing a Poll**
1. Navigate to active polls list
2. Click "Close Poll" next to target poll
3. Results freeze; viewers can see final percentages
4. Optional: Export results to CSV

**Deleting Inappropriate Messages**
1. Navigate to "Chat Moderation"
2. Find offending message in list
3. Click "Delete" → message soft-deleted
4. Viewers see "[Message removed by moderator]"

**Emergency Procedures**
- **Video not loading:** Switch to backup playback ID
- **Chat spam:** Increase rate limit via config (requires redeploy)
- **Admin locked out:** Use emergency credentials (stored offline)
- **Site down:** Check Vercel dashboard; rollback if needed

### E. Viewer Instructions (Sample)

**Joining the Event**
1. Click the link you received via email
2. Enter the event password: `[PROVIDED_SEPARATELY]`
3. Wait for the video to load (should take 3-5 seconds)

**Watching the Video**
- Click play button if video doesn't auto-start
- Use spacebar to play/pause
- Use arrow keys to adjust volume
- Click fullscreen icon for immersive viewing

**Participating in Chat**
- Type your message in the box at bottom-right
- Press Enter or click Send
- You can send one message every 2 seconds
- Be respectful and on-topic

**Voting in Polls**
- Polls appear as special messages in the chat
- Click your preferred option
- You can change your vote until the poll closes
- Results update in real-time

**Technical Requirements**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Broadband internet (5+ Mbps recommended)
- Enable JavaScript and cookies
- For best experience: Use headphones and close other tabs

**Need Help?**
- Refresh the page if video stops loading
- Try a different browser if issues persist
- Contact [ADMIN_EMAIL] for urgent technical support

---

## 17. Sign-Off & Approval

**Document Prepared By:**
- Product Manager: [Name]
- Technical Lead: [Name]
- Date: [Date]

**Reviewed and Approved By:**
- Engineering: ☐ Approved ☐ Pending ☐ Changes Requested
- Design: ☐ Approved ☐ Pending ☐ Changes Requested  
- Operations: ☐ Approved ☐ Pending ☐ Changes Requested
- Stakeholder: ☐ Approved ☐ Pending ☐ Changes Requested

**Version History:**
- v1.0 (Original PRD)
- v2.0 (Improved PRD with enhanced detail, security, testing, and operational guidance)

**Next Steps:**
1. Kickoff meeting with development team
2. Sprint planning and task breakdown
3. Set up development environment
4. Begin Day 1 implementation
5. Schedule dry run 48 hours before event

---

## Document End

**Questions or Clarifications:**
Contact the product team at [contact_info] or open an issue in the project repository.