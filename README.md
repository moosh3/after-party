# Event Streaming Platform

A private event streaming platform built with Next.js 14, Supabase, and Mux for live and VOD content delivery.

## 📚 Quick Links

- **[Quick Mux Setup](QUICK_MUX_SETUP.md)** - Get a video playing in 10 minutes
- **[Mux Video Guide](MUX_VIDEO_GUIDE.md)** - Comprehensive video upload guide
- **[Vercel Deployment](VERCEL_DEPLOYMENT.md)** - Deploy to production
- **[Deployment Checklist](DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist

## Features

- 🎥 Live and VOD video streaming powered by Mux
- 💬 Real-time chat system with persistent display names
- 📊 Interactive polls
- 🔐 Password-protected admin access
- 👥 Viewer registration with display names
- 👨‍💼 Admin panel for content management
- 🎨 Modern, responsive UI with Tailwind CSS

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Video:** Mux
- **Styling:** Tailwind CSS
- **Authentication:** Custom JWT-based auth
- **Deployment:** Vercel

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Mux account (free tier with $20 credit)
- Vercel account (for deployment)

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd after-party
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API to get your credentials
3. Go to SQL Editor and run the schema from `sql/schema.sql`
4. Enable Realtime for the following tables:
   - `messages`
   - `current_stream`

### 4. Set up Mux

1. Create an account at [mux.com](https://mux.com)
2. Go to Settings → Access Tokens to generate API keys
3. Go to Settings → Signing Keys to create a signing key pair

### 5. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Update the following values in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `MUX_TOKEN_ID` - Your Mux token ID
- `MUX_TOKEN_SECRET` - Your Mux token secret
- `MUX_SIGNING_KEY_ID` - Your Mux signing key ID
- `MUX_SIGNING_KEY_PRIVATE` - Your Mux signing key private key

**Note:** The placeholder passwords are:
- Viewer: `viewer123`
- Admin: `admin123`

To change passwords, generate new bcrypt hashes:

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 10));"
```

### 6. Run the development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   ├── event/             # Event viewer page
│   ├── admin/             # Admin panel
│   └── api/               # API routes
├── lib/                   # Core utilities
│   ├── supabase.ts       # Supabase client
│   ├── mux.ts            # Mux client
│   └── config.ts         # App configuration
├── components/           # React components
│   └── ui/              # Shared UI components
├── sql/                  # Database schemas
│   └── schema.sql       # Supabase schema
├── public/              # Static assets
└── slices/              # Development slices (documentation)
```

## Deployment to Vercel

### 1. Install Vercel CLI (optional)

```bash
npm install -g vercel
```

### 2. Deploy via CLI

```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### 3. Configure environment variables

In your Vercel project dashboard:
1. Go to Settings → Environment Variables
2. Add all variables from `.env.local`
3. Make sure to set them for Production, Preview, and Development environments

### 4. Environment variables needed in Vercel:

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
MUX_TOKEN_ID
MUX_TOKEN_SECRET
MUX_SIGNING_KEY_ID
MUX_SIGNING_KEY_PRIVATE
VIEWER_PASSWORD_HASH
ADMIN_PASSWORD_HASH
SESSION_SECRET
NEXT_PUBLIC_EVENT_DATE
EVENT_ROOM_ID
```

### 5. Deploy

```bash
vercel --prod
```

## API Endpoints

- `GET /api/health` - Health check endpoint

## Testing

### Manual Tests

1. Visit the homepage - should see landing page with two buttons
2. Click "Join Event" - should see placeholder event page
3. Click "Admin Panel" - should see placeholder admin page
4. Visit `/api/health` - should return JSON with status "ok"

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-11T...",
  "service": "event-streaming-platform"
}
```

## Development Slices

This project is developed in slices (incremental features):

1. ✅ **Foundation** - Project setup, database, basic structure (current)
2. 🔜 **Authentication** - Viewer and admin authentication
3. 🔜 **Video Playback** - Mux integration and video player
4. 🔜 **Stream Management** - Admin controls for managing streams
5. 🔜 **Chat System** - Real-time chat and polls

See the `slices/` directory for detailed specifications.

## Database Schema

The database includes tables for:
- `current_stream` - Active stream configuration
- `mux_items` - Video asset catalog
- `messages` - Chat messages
- `polls`, `poll_options`, `poll_votes` - Polling system
- `chat_throttle` - Rate limiting
- `admin_actions` - Audit log

See `sql/schema.sql` for the complete schema.

## Security Notes

- Never commit `.env.local` to version control
- Keep your Supabase service role key secret (server-side only)
- Rotate API keys regularly
- Use strong passwords for production
- Enable RLS policies in Supabase for additional security

## Troubleshooting

### Issue: TypeScript errors on first run

Solution: Run `npm run build` once to generate Next.js type definitions.

### Issue: Supabase connection fails

Solution: Verify your Supabase URL and keys in `.env.local`. Make sure the project is active.

### Issue: Mux token errors

Solution: Check that your Mux signing key is correctly formatted (should be a private key string).

## Contributing

This is a private event platform. See `PRD.md` for the complete product requirements.

## License

Private - All rights reserved

