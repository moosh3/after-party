# Deployment Checklist - Environment Variables

## Critical Environment Variables Required for Production

### 1. Database (Supabase)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Session Security
```bash
SESSION_SECRET=your-32+-character-secure-random-string
```
**Generate with:** `openssl rand -base64 32`

### 3. Mux Video Streaming
```bash
MUX_TOKEN_ID=your-mux-token-id
MUX_TOKEN_SECRET=your-mux-token-secret
MUX_SIGNING_KEY_ID=your-mux-signing-key-id
MUX_SIGNING_KEY_PRIVATE=your-mux-private-key
```

### 4. Admin Authentication
```bash
ADMIN_PASSWORD_HASH=your-bcrypt-hash
```
**Generate with:** `npm run generate-admin-hash`

---

## Current 500 Error Troubleshooting

The `/api/current` endpoint is returning 500, likely because:

1. **Mux credentials not set** - Our security hardening now requires valid Mux credentials in production
2. **Database migration not run** - The `playback_elapsed_ms` column might be missing

### Quick Fix Steps:

#### Step 1: Check Server Logs
Look for error messages containing:
- `MUX_SIGNING_KEY_ID not configured`
- `MUX_SIGNING_KEY_PRIVATE not configured`
- `Failed to generate Mux playback token`

#### Step 2: Verify Environment Variables
On your production server (Vercel/etc), ensure ALL Mux variables are set:
```bash
# These must all be present and non-empty:
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_SIGNING_KEY_ID
MUX_SIGNING_KEY_PRIVATE
```

#### Step 3: Run Database Migration
If you haven't already, run:
```bash
psql $DATABASE_URL -f sql/010_playback_elapsed_time.sql
```

#### Step 4: Check Session Secret
Ensure `SESSION_SECRET` is set and at least 32 characters:
```bash
export SESSION_SECRET="$(openssl rand -base64 32)"
```

---

## How to Check What's Wrong

### Option 1: Check Deployment Logs
Look at your server/deployment logs for the exact error:
- Vercel: Check Function Logs
- Docker: `docker logs <container-id>`
- PM2: `pm2 logs`

### Option 2: Test Locally
```bash
# Set production env vars in .env.local
npm run build
npm start

# Then visit http://localhost:3000/api/current
```

### Option 3: Add Temporary Debug Endpoint
We can add a health check endpoint to verify all credentials are set.

---

## What Changed in Recent Fixes

Our security hardening now:
1. **Requires** Mux credentials in production (no unsafe fallbacks)
2. **Requires** SESSION_SECRET to be 32+ characters in production
3. **Validates** credentials at startup rather than silently failing

This is **intentional** - it's better to fail fast and show what's wrong than to run with insecure configuration.

---

## Quick Recovery Plan

If you need to get the site working immediately while fixing credentials:

### Temporary Workaround (NOT RECOMMENDED FOR PRODUCTION):
Set `NODE_ENV=development` to allow placeholder tokens, BUT this is insecure and should only be temporary.

### Proper Fix:
1. Set all required environment variables in your deployment platform
2. Redeploy the application
3. Verify `/api/current` returns 200 with valid token

---

## Verification Commands

After setting environment variables:

```bash
# Test the endpoint
curl -v https://www.alecandmk.stream/api/current

# Should return 200 with JSON containing:
# - playbackId
# - title
# - kind
# - token (actual JWT, not "placeholder-token")
# - expiresAt
# - showPoster
```

Expected successful response:
```json
{
  "playbackId": "abc123...",
  "title": "Movie Title",
  "kind": "vod",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2025-11-01T12:00:00.000Z",
  "showPoster": false
}
```

If you get 503 with "Video service not configured":
- Mux credentials are missing or invalid

If you get 500 with other error:
- Check server logs for specific error message
- Likely database connection issue or missing migration

