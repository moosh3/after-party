# Quick Mux Setup - TL;DR

**Goal**: Get a video playing on your stream in under 10 minutes.

## 1️⃣ Upload Video to Mux (5 min)

```
🌐 Go to: https://dashboard.mux.com
📁 Click: "Video" → "Upload a video"
📤 Select: Your video file
⏳ Wait: Until status = "ready"
📋 Copy: The Playback ID (looks like: abc123xyz456)
```

## 2️⃣ Configure Mux Settings (2 min)

In Mux Dashboard → Settings → Access Tokens:

1. **Create API Access Token**
   - Click "Generate new token"
   - Copy: `Token ID` and `Token Secret`

2. **Create Signing Key**
   - Go to Settings → Signing Keys
   - Click "Generate new key"
   - Copy: `Key ID` and `Private Key`

## 3️⃣ Set Environment Variables (1 min)

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```env
MUX_TOKEN_ID=abc123...
MUX_TOKEN_SECRET=xyz789...
MUX_SIGNING_KEY_ID=key123...
MUX_SIGNING_KEY_PRIVATE=-----BEGIN PRIVATE KEY-----...
```

**Then**: Redeploy your app for changes to take effect.

## 4️⃣ Add Video to Your App (2 min)

```
🔐 Visit: https://your-app.vercel.app/admin/login
🔑 Login with: Your admin password
📝 Scroll to: "Add New Mux Item"
🆔 Paste: Playback ID from step 1
📌 Enter: A title (e.g., "Horror Movie Night")
✅ Click: "Add & Make Current"
```

## ✨ Done!

Your video is now live! Viewers can:
- Watch the video
- Chat with their display names
- Vote in polls
- Enjoy the stream!

---

## 🔴 For Live Streaming Instead

1. **Create Live Stream** in Mux Dashboard
2. **Copy**: RTMP URL + Stream Key
3. **Open OBS Studio**
   - Settings → Stream → Custom
   - Paste RTMP URL and Stream Key
4. **Start Streaming** in OBS
5. **Copy**: Playback ID from Mux
6. **Add to app** via admin panel (same as step 4 above)

---

## 🆘 Something Not Working?

### Video won't play?
- Check video status in Mux = "ready" (not "preparing")
- Verify Playback ID is correct
- Check browser console for errors

### Can't add video to app?
- Verify signing keys are set in Vercel
- Redeploy after adding environment variables
- Check admin panel console for errors

### Need more details?
- See: `MUX_VIDEO_GUIDE.md` (comprehensive guide)
- See: `VERCEL_DEPLOYMENT.md` (deployment help)

