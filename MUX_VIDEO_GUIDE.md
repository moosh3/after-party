# Mux Video Upload & Management Guide

This guide explains how to upload videos to Mux and use them in your After Party application.

## Table of Contents
1. [Option 1: On-Demand Video (VOD) - Upload a Video File](#option-1-on-demand-video-vod)
2. [Option 2: Live Streaming](#option-2-live-streaming)
3. [Adding Videos to Your App](#adding-videos-to-your-app)
4. [Troubleshooting](#troubleshooting)

---

## Option 1: On-Demand Video (VOD)

Use this if you have pre-recorded video files (like movies, recordings, etc.).

### Step 1: Upload Video to Mux

#### Method A: Via Mux Dashboard (Easiest)

1. **Go to Mux Dashboard**
   - Navigate to: https://dashboard.mux.com
   - Login to your account

2. **Upload Video**
   - Click on **"Video"** in the left sidebar
   - Click **"Upload a video"** button
   - Choose your video file (supports MP4, MOV, AVI, etc.)
   - Wait for upload to complete

3. **Configure Settings**
   - **Playback Policy**: Select **"Signed"** (most secure, requires tokens)
     - OR select **"Public"** for easier testing (less secure)
   - **Encoding Tier**: Choose based on quality needs
     - **Standard** (720p max, cheaper)
     - **Premium** (4K, higher quality, more expensive)

4. **Get Playback ID**
   - Once upload completes, go to the asset details
   - Copy the **Playback ID** (looks like: `abc123xyz456def789`)
   - You'll need this to add the video to your app

#### Method B: Via Mux API (Advanced)

You can also upload via direct URL:

```bash
curl https://api.mux.com/video/v1/assets \
  -u {MUX_TOKEN_ID}:{MUX_TOKEN_SECRET} \
  -H "Content-Type: application/json" \
  -d '{
    "input": "https://example.com/path-to-your-video.mp4",
    "playback_policy": ["signed"]
  }'
```

Or upload from your local machine using the Mux Uploader:
- Documentation: https://docs.mux.com/guides/video/upload-files-directly

### Step 2: Wait for Processing

- Mux will process your video (encoding, thumbnails, etc.)
- Processing time depends on video length and size
- You can check status in the Mux dashboard
- Status will show: **"preparing" → "ready"**

### Step 3: Get Asset Information

Once processing is complete:

1. Click on your video asset in Mux dashboard
2. Note the following:
   - **Playback ID**: Main identifier for playback
   - **Duration**: Total length of video
   - **Status**: Should be "ready"

---

## Option 2: Live Streaming

Use this if you want to stream live content in real-time.

### Step 1: Create a Live Stream

1. **Go to Mux Dashboard**
   - Navigate to: https://dashboard.mux.com
   - Click **"Live Streams"** in left sidebar

2. **Create New Live Stream**
   - Click **"Create new live stream"**
   - **Settings**:
     - **Playback Policy**: Choose "Signed" or "Public"
     - **Reconnect Window**: 60 seconds (recommended)
     - **Max Continuous Duration**: Set based on your event length

3. **Get Stream Information**
   After creation, you'll receive:
   - **Stream Key**: Used to broadcast (keep this SECRET!)
   - **RTMP URL**: Where to send your stream
   - **Playback ID**: Use this in your app

### Step 2: Set Up Broadcasting Software

Use OBS Studio, Streamlabs, or similar:

**OBS Studio Setup:**
1. Download OBS: https://obsproject.com/
2. Open OBS → Settings → Stream
3. **Service**: Custom
4. **Server**: Copy RTMP URL from Mux (e.g., `rtmps://global-live.mux.com:443/app`)
5. **Stream Key**: Paste your stream key from Mux
6. Click **OK** and **Start Streaming**

**Alternative Broadcasting Options:**
- **Zoom**: Can output RTMP stream
- **Restream.io**: Multi-platform streaming
- **Mobile**: Use apps like Larix Broadcaster
- **Hardware Encoder**: Teradek, LiveU, etc.

### Step 3: Test Your Stream

1. Start broadcasting in OBS
2. Check Mux dashboard - status should show "active"
3. Note the **Playback ID** from the live stream details

---

## Adding Videos to Your App

Once you have a Playback ID (from VOD or Live Stream):

### Method 1: Via Admin Panel (Easiest)

1. **Login to Admin Panel**
   - Go to: `https://your-app.vercel.app/admin/login`
   - Enter your admin password

2. **Add Mux Item**
   - Scroll to **"Add New Mux Item"** section
   - **Playback ID**: Paste the playback ID from Mux
   - **Title/Label**: Give it a friendly name (e.g., "Movie 1: The Shining")
   - Click **"Add to Library"** (saves for later use)
   - OR click **"Add & Make Current"** (starts streaming immediately)

3. **Switch Between Videos**
   - In the **"Select from Library"** section
   - Click **"Make Current"** on any saved video
   - All viewers will automatically switch to the new video

### Method 2: Via Database (Advanced)

Directly insert into Supabase:

```sql
INSERT INTO mux_items (playback_id, label, kind, duration_seconds)
VALUES ('your-playback-id-here', 'Movie Title', 'vod', 7200);
```

### Method 3: Via API (Advanced)

```bash
curl -X POST https://your-app.vercel.app/api/admin/mux-items \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=YOUR_SESSION_TOKEN" \
  -d '{
    "playbackId": "your-playback-id",
    "label": "Movie Title",
    "kind": "vod",
    "durationSeconds": 7200
  }'
```

---

## Understanding Video Types

### VOD (Video on Demand)
- **Best for**: Pre-recorded content, movies, recorded events
- **Pros**: Reliable, can test beforehand, seekable
- **Cons**: Must upload in advance, larger upfront cost
- **Use when**: You have the video file ready

### Live Stream
- **Best for**: Real-time events, live commentary, broadcasts
- **Pros**: Real-time, lower storage costs, interactive
- **Cons**: Requires broadcasting setup, can't seek backward
- **Use when**: Content is happening live

---

## Cost Considerations

### Mux Pricing (as of 2024)
- **Video Storage**: $0.01/GB/month
- **Video Encoding**: 
  - Standard: $0.005/minute
  - Premium: $0.02/minute
- **Video Streaming**: $0.01/GB delivered
- **Live Stream Hours**: $4/hour

**Free Tier:**
- $20 credit/month
- Good for testing or small events

**Cost Examples:**
- 2-hour movie (1080p): ~$1.50 encoding + $0.50/month storage
- 4-hour live stream: ~$16
- 100 viewers watching 2hrs: ~$20 bandwidth

---

## Mux Setup Checklist

Before adding videos, ensure you have:

- [ ] Mux account created
- [ ] API access token created (Token ID + Secret)
- [ ] Signing key created (Key ID + Private Key)
- [ ] Environment variables set:
  - `MUX_TOKEN_ID`
  - `MUX_TOKEN_SECRET`
  - `MUX_SIGNING_KEY_ID`
  - `MUX_SIGNING_KEY_PRIVATE`
- [ ] Video uploaded (or live stream created)
- [ ] Playback ID copied

---

## Troubleshooting

### "Video won't play"
- **Check**: Playback policy - if "signed", ensure signing keys are configured
- **Check**: Video status in Mux - must be "ready" (not "preparing")
- **Check**: Browser console for errors
- **Solution**: Try switching to "public" playback policy for testing

### "Asset not found"
- **Check**: Playback ID is correct (no typos)
- **Check**: Asset exists in your Mux account
- **Check**: Using the right Mux account (if you have multiple)

### "Token expired" or "Invalid token"
- **Check**: Signing key credentials are correct
- **Check**: System time is accurate (JWT tokens are time-sensitive)
- **Solution**: Regenerate signing keys in Mux dashboard

### "Stream not starting"
- **Check**: Stream key is correct in OBS
- **Check**: RTMP URL is correct
- **Check**: Internet connection is stable
- **Check**: Firewall isn't blocking RTMP (port 1935)
- **Solution**: Try RTMPS (secure) instead: `rtmps://global-live.mux.com:443/app`

### "Poor video quality"
- **For VOD**: Upload higher quality source file
- **For Live**: Increase bitrate in OBS (Settings → Output → Bitrate)
- **For VOD**: Use Premium encoding tier in Mux

### "High costs"
- **Reduce**: Use standard encoding instead of premium
- **Reduce**: Optimize video before upload (compress, lower resolution)
- **Reduce**: Delete old/unused assets
- **Monitor**: Set up billing alerts in Mux dashboard

---

## Best Practices

### For VOD
1. **Optimize before upload**
   - Compress videos using HandBrake or FFmpeg
   - 1080p @ 5-8 Mbps is usually sufficient
2. **Use thumbnails** - Mux generates these automatically
3. **Test playback** before your event
4. **Signed playback** - More secure for premium content

### For Live Streaming
1. **Test beforehand** - Stream to Mux test stream first
2. **Stable internet** - Use wired connection, not WiFi
3. **Backup plan** - Have a backup internet connection
4. **Monitor health** - Watch Mux dashboard during stream
5. **Recording** - Enable DVR in Mux to save the stream

### For Both
1. **Use meaningful labels** - Helps organize your library
2. **Set duration** - Helps viewers know video length
3. **Monitor costs** - Check Mux usage dashboard regularly
4. **Delete old content** - Save on storage costs

---

## Quick Start Example

**Scenario**: You want to stream a 2-hour movie.

1. **Upload to Mux** (5 minutes)
   - Go to dashboard.mux.com
   - Upload → Select video file
   - Wait for "ready" status

2. **Get Playback ID** (30 seconds)
   - Click on your asset
   - Copy playback ID: `abc123xyz`

3. **Add to Your App** (1 minute)
   - Login to `/admin/login`
   - Playback ID: `abc123xyz`
   - Title: "The Shining"
   - Click "Add & Make Current"

4. **Done!** 
   - All viewers can now watch your movie
   - Chat, polls, and all features work

---

## Additional Resources

- [Mux Documentation](https://docs.mux.com/)
- [Mux Upload Guide](https://docs.mux.com/guides/video/upload-files-directly)
- [Mux Live Streaming Guide](https://docs.mux.com/guides/video/stream-live-video)
- [OBS Setup Guide](https://obsproject.com/wiki/)
- [Video Encoding Best Practices](https://docs.mux.com/guides/video/optimize-video-quality)

---

## Need Help?

- **Mux Support**: support@mux.com
- **Mux Community**: https://discord.gg/mux
- **Mux Status**: https://status.mux.com/

Happy streaming! 🎬🍿

