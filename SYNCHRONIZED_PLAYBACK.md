# Synchronized Playback - Watch Party Mode

Your After Party platform now supports **synchronized playback**, allowing all viewers to watch VOD (Video on Demand) content together in real-time, like a virtual movie night!

## 🎬 How It Works

### For Viewers
- **Everyone watches together** - All viewers see the exact same moment at the same time
- **Auto-sync** - Video automatically syncs every 10 seconds to prevent drift
- **No manual controls** - Play/Pause buttons are controlled by the host
- **Full volume control** - Viewers can adjust their own volume and mute
- **Sync indicator** - Shows "Watching Together - Synced" badge

### For Admins (Host)
- **Full control** - Play, Pause, and Restart the video for everyone
- **Instant updates** - All viewers sync within 1-2 seconds
- **Real-time monitoring** - See current playback state in admin panel

## 🚀 Quick Start

### 1. Upload Your Video to Mux
Follow the [Mux Video Guide](MUX_VIDEO_GUIDE.md) to upload your content.

### 2. Add Video to Your Stream
1. Login to admin panel: `/admin/login`
2. Add your video via Playback ID
3. Click "Make Current" to set it live

### 3. Control Playback
In the admin panel, you'll see **"Synchronized Playback Control"**:
- **Play** - Start video for all viewers
- **Pause** - Pause video for all viewers  
- **Restart** - Jump back to beginning for everyone

### 4. Done!
All viewers automatically follow your playback commands!

## 📊 Technical Details

### Architecture
```
┌─────────────┐
│    Admin    │ ──[Controls]──► Database (current_stream)
└─────────────┘                       │
                                     │ Realtime
                                     │ Updates
                                     ▼
                        ┌──────────────────────────┐
                        │   All Viewer Browsers    │
                        │  Auto-sync & Follow      │
                        └──────────────────────────┘
```

### Synchronization Logic

1. **Admin Action**: Admin clicks Play/Pause/Restart
2. **Database Update**: `current_stream` table updated with:
   - `playback_state`: 'playing' or 'paused'
   - `playback_position`: Current timestamp in seconds
   - `playback_updated_at`: Server timestamp
3. **Realtime Broadcast**: Supabase broadcasts change to all connected clients
4. **Client Sync**: Each viewer:
   - Receives the update instantly
   - Calculates drift based on time elapsed since update
   - Seeks to correct position if >3 seconds off
   - Matches play/pause state

### Sync Accuracy
- **Initial sync**: < 2 seconds
- **Drift correction**: Checks every 10 seconds
- **Acceptable drift**: ±3 seconds (auto-corrects beyond this)
- **Network latency**: Accounts for time since last update

### Database Schema
```sql
ALTER TABLE current_stream 
ADD COLUMN playback_state text CHECK (playback_state IN ('playing', 'paused')),
ADD COLUMN playback_position numeric,  -- Position in seconds
ADD COLUMN playback_updated_at timestamptz;
```

## 🎯 Use Cases

### Movie Marathon
```
1. Upload 3 horror movies to Mux
2. Add all to your library
3. Start with Movie 1 - Click "Play" when ready
4. When movie ends, switch to Movie 2, click "Restart" then "Play"
5. Repeat for Movie 3
```

### Live Commentary
```
1. Set up video
2. Hit "Play" to start
3. Pause at key moments to discuss in chat
4. Resume when ready
```

### Timed Event
```
1. Upload countdown video or special intro
2. Set video live but keep paused
3. At event time: Hit "Play" 
4. Everyone starts watching at exact same moment!
```

## 🔧 Setup Instructions

### Step 1: Run Database Migration

If deploying fresh, run:
```bash
# Apply the synchronized playback schema
npm run setup:db
# This runs all SQL files including 004_synchronized_playback.sql
```

Or manually in Supabase SQL Editor:
```sql
-- Copy and paste content from: 
-- sql/004_synchronized_playback.sql
```

### Step 2: Enable Realtime (Already Done!)

The `current_stream` table is already enabled for realtime in `sql/003_enable_realtime.sql`.

### Step 3: Deploy

Deploy to Vercel and it works automatically!

## 💡 Tips & Best Practices

### For Best Sync
1. **Start fresh** - Click "Restart" before beginning to ensure everyone starts at 0:00
2. **Stable connection** - Viewers need stable internet for smooth playback
3. **Buffer time** - Wait 5 seconds after clicking Play for everyone to buffer

### Managing Long Videos
1. **Natural breaks** - Pause at chapter marks or intermissions
2. **Chat during pauses** - Great time for audience interaction
3. **Restart between segments** - Start each segment from 0:00

### Handling Issues
- **Viewer out of sync?** - They'll auto-sync within 10 seconds
- **Major drift?** - Pause then Play to force re-sync
- **Video stuck?** - Have viewer refresh their browser

## 🎮 Admin Controls Reference

### Play Button (▶)
- **Action**: Starts playback for all viewers
- **State**: Disabled when already playing
- **Effect**: Instant (1-2 second delay for buffering)

### Pause Button (⏸)
- **Action**: Pauses playback for all viewers
- **State**: Disabled when already paused
- **Effect**: Instant freeze for all viewers

### Restart Button (⟲)
- **Action**: Jumps to 0:00 and auto-plays
- **Use case**: Start movie from beginning
- **Effect**: All viewers seek to start

## 📱 Viewer Experience

### What Viewers See

**Sync Indicator:**
```
🟣 Watching Together - Synced
```

**Disabled Controls:**
- Play/Pause buttons are grayed out
- Hover shows: "Playback controlled by host"
- Volume controls work normally

**Auto-Sync Behavior:**
- Video may briefly pause/seek to sync
- Usually seamless and unnoticeable
- Console shows: "Syncing: seeking to X seconds"

## 🐛 Troubleshooting

### Problem: Viewers not syncing

**Check:**
1. Supabase realtime enabled: `sql/003_enable_realtime.sql`
2. Database migration applied: `sql/004_synchronized_playback.sql`
3. Browser console for errors

**Solution:**
```bash
# Re-run realtime setup
psql -f sql/003_enable_realtime.sql
```

### Problem: Major drift (>10 seconds)

**Cause:** Network issues or browser throttling inactive tabs

**Solution:**
1. Pause the video
2. Wait 3 seconds
3. Click Play again
4. Or have viewers refresh their browser

### Problem: Admin controls not responding

**Check:**
1. Logged in as admin
2. Session not expired
3. Network connection stable

**Solution:**
- Re-login to admin panel
- Check browser console for API errors

### Problem: Video won't play for anyone

**Check:**
1. Mux playback ID is correct
2. Mux video status is "ready"
3. Signing keys configured correctly

**Solution:**
- Test video in Mux dashboard first
- Verify environment variables in Vercel

## 🔐 Security Notes

- Only admins can control playback (enforced server-side)
- Viewers receive read-only playback state
- All API endpoints require authentication
- Realtime updates are one-way (admin → viewers)

## ⚡ Performance

### Bandwidth
- Realtime updates: ~1 KB per update
- Video streaming: Same as normal (Mux CDN)
- No additional overhead for sync

### Scalability
- Supports hundreds of concurrent viewers
- Supabase realtime handles broadcasting
- Mux CDN handles video delivery
- No server-side processing required

## 🎉 Benefits Over Traditional Live Streaming

| Feature | Live Stream | Synced VOD |
|---------|-------------|------------|
| **Seek backward** | ❌ No | ✅ Yes (admin only) |
| **Restart** | ❌ No | ✅ Yes |
| **Pause mid-stream** | ❌ No | ✅ Yes |
| **Pre-upload** | ❌ Must stream live | ✅ Upload anytime |
| **Quality** | Variable | ✅ Consistent |
| **Cost** | $4/hour | ~$2 total |
| **Setup** | Complex (OBS, encoder) | Simple (upload) |
| **Reliability** | Network dependent | ✅ CDN backed |

## 📚 Related Documentation

- [Mux Video Guide](MUX_VIDEO_GUIDE.md) - How to upload videos
- [Quick Mux Setup](QUICK_MUX_SETUP.md) - 10-minute setup guide
- [Vercel Deployment](VERCEL_DEPLOYMENT.md) - Deploy your app
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Pre-launch checklist

## 🆕 What's New

This synchronized playback feature adds:
- ✅ Real-time playback synchronization
- ✅ Admin playback controls (Play/Pause/Restart)
- ✅ Auto-sync every 10 seconds
- ✅ Drift detection and correction
- ✅ Visual sync indicators for viewers
- ✅ Database schema for playback state
- ✅ API endpoints for playback control

## 💬 FAQ

**Q: Can I still use live streams?**
A: Yes! Live streams work as before. Sync is only for VOD content.

**Q: Can viewers pause their own video?**
A: No, this defeats the "watch together" experience. Viewers can only control volume.

**Q: What if a viewer joins late?**
A: They'll sync to current playback position automatically.

**Q: Can I seek to specific timestamp?**
A: Currently: Restart only. Coming soon: Seek to timestamp feature.

**Q: Does this work on mobile?**
A: Yes! Works on all devices with a web browser.

**Q: What's the maximum number of viewers?**
A: Thousands! Limited by Mux CDN (very high) and Supabase realtime (1000+ concurrent).

---

## 🎬 Ready to Host a Watch Party?

1. Upload your video to Mux
2. Add it to your stream  
3. Click "Play" in admin panel
4. Everyone watches together!

Enjoy your synchronized streaming experience! 🎉🍿

