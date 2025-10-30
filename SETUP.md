# Local Development Setup Guide

## ✅ Current Status

Your project is **ready to run locally**! The UI is fully built and the development server is configured.

## 🚀 Quick Start

### 1. Environment Variables

A `.env.local` file has been created with placeholder values. The app will run with these defaults:

- **Admin Password**: `admin123`
- **Viewer Password**: `viewer123` (not enforced in dev mode)

### 2. Start the Development Server

```bash
npm run dev
```

The app will be available at: http://localhost:3000

### 3. Access the Application

- **Landing Page**: http://localhost:3000
- **Event Page**: http://localhost:3000/event
- **Admin Panel**: http://localhost:3000/admin/login

## 📋 What's Working

✅ **UI Components Built:**
- Landing page with navigation
- Video player with HLS.js integration
- Real-time chat system
- Interactive polls
- Admin dashboard with stream controls
- Admin login page
- Responsive design (mobile + desktop)

✅ **Features Implemented:**
- Video streaming (requires Mux configuration)
- Chat with real-time updates (requires Supabase)
- Poll creation and voting (requires Supabase)
- Admin authentication
- Stream switching

## ⚠️ What Needs Configuration

To fully test the app, you'll need to set up:

### 1. Supabase (Database & Realtime)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon`/`public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **SQL Editor** and run the schema from `sql/schema.sql`
5. **Enable Realtime** using Postgres Changes (IMPORTANT for real-time updates):
   
   **Easiest: Using Supabase Dashboard** (Recommended for beginners):
   1. Go to: https://app.supabase.com → Your Project → **Database → Replication**
   2. Find or create the `supabase_realtime` publication
   3. Click to add these tables: `messages`, `current_stream`, `polls`, `poll_votes`
   4. All events (INSERT, UPDATE, DELETE) are automatically enabled ✅
   
   **Alternative: Using SQL**:
   In Supabase SQL Editor, run:
   ```bash
   npm run enable:realtime
   ```
   Or manually paste contents of `sql/enable_realtime.sql` into SQL Editor
   
   **Why Postgres Changes?** 
   This app uses anonymous viewers (localStorage-based auth), not Supabase authenticated users. 
   The [Postgres Changes method](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes#using-postgres-changes) is perfect for this use case. 
   The [Broadcast method](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes#using-broadcast) requires authenticated users and is better for apps with complex authorization needs.

### 2. Mux (Video Streaming)

1. Create a free account at [mux.com](https://mux.com)
2. Go to **Settings → Access Tokens** and create a new token:
   - Copy Token ID → `MUX_TOKEN_ID`
   - Copy Token Secret → `MUX_TOKEN_SECRET`
3. Go to **Settings → Signing Keys** and create a new signing key:
   - Copy Key ID → `MUX_SIGNING_KEY_ID`
   - Copy Private Key → `MUX_SIGNING_KEY_PRIVATE`

### 3. Update .env.local

Replace the placeholder values in `.env.local` with your actual credentials.

## 🧪 Testing Without Full Setup

Even without Supabase and Mux configured, you can:

1. **View the UI**: All pages render correctly
2. **Test Navigation**: Navigate between pages
3. **See the Layout**: Video player, chat, and poll components display
4. **Admin Login**: Use password `admin123`

## 📦 Project Structure

```
after-party/
├── app/
│   ├── page.tsx              # Landing page
│   ├── event/page.tsx        # Event viewer page
│   ├── admin/                # Admin pages
│   └── api/                  # API routes
├── components/
│   ├── VideoPlayer.tsx       # HLS video player
│   ├── Chat.tsx              # Real-time chat
│   ├── PollCard.tsx          # Interactive polls
│   └── admin/
│       └── StreamControl.tsx # Admin controls
├── lib/                      # Utility functions
├── hooks/                    # React hooks
└── sql/                      # Database schema

```

## 🎨 UI Features

### Desktop Layout (≥1024px)
- 70% width video player (left)
- 30% width chat sidebar (right)
- Fixed header with event info

### Mobile Layout (≤768px)
- Full-width video player
- Stacked chat below
- Touch-optimized controls

### Theme
- Dark mode optimized
- Slate/Blue color scheme
- Smooth animations
- Loading states
- Error handling

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Test Supabase connection
npm run test:supabase

# Test Mux connection
npm run test:mux

# Generate admin password hash
npm run generate-admin-hash
```

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
→ Check your Supabase URL and keys in `.env.local`

### "Video won't play"
→ Check your Mux signing keys are correct

### "Chat messages not appearing"
→ Enable Realtime on the `messages` table in Supabase

### "Build errors"
→ Run `npm install` to ensure all dependencies are installed

## 📚 Next Steps

1. **Set up Supabase** (15 minutes)
   - Create account and project
   - Run SQL schema
   - Enable Realtime

2. **Set up Mux** (10 minutes)
   - Create account
   - Generate tokens and signing keys
   - Upload a test video

3. **Test the flow** (5 minutes)
   - Start dev server
   - Login as admin
   - Set a stream
   - View as a user
   - Test chat and polls

## 📖 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Mux Documentation](https://docs.mux.com)
- [HLS.js Documentation](https://github.com/video-dev/hls.js)

## 🎯 Production Deployment

See `README.md` for Vercel deployment instructions.

---

**Questions?** Check the troubleshooting section or review the PRD.md for detailed specifications.
