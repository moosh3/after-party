# Pre-Deployment Checklist

Use this checklist before deploying to Vercel to ensure everything is ready.

## ✅ Prerequisites

- [ ] Code is committed to Git
- [ ] Repository is pushed to GitHub
- [ ] Vercel account created
- [ ] Supabase project created
- [ ] Mux account set up (if using video streaming)

## ✅ Database Setup

- [ ] Supabase database schema created (`sql/001_schema.sql`)
- [ ] Realtime triggers configured (`sql/002_realtime_triggers.sql`)
- [ ] Realtime enabled for tables (`sql/003_enable_realtime.sql`)
- [ ] Tables enabled for realtime:
  - [ ] `messages`
  - [ ] `polls`
  - [ ] `poll_options`
  - [ ] `streams`

## ✅ Environment Variables Prepared

### Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - copied from Supabase dashboard
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - copied from Supabase dashboard
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - copied from Supabase dashboard

### Mux
- [ ] `MUX_TOKEN_ID` - from Mux dashboard
- [ ] `MUX_TOKEN_SECRET` - from Mux dashboard
- [ ] `MUX_SIGNING_KEY_ID` - from Mux dashboard
- [ ] `MUX_SIGNING_KEY_PRIVATE` - from Mux dashboard

### Application
- [ ] `SESSION_SECRET` - generated secure random string (32+ characters)
- [ ] `ADMIN_PASSWORD_HASH` - generated using `npm run generate-admin-hash`
- [ ] `NEXT_PUBLIC_EVENT_DATE` (optional)
- [ ] `EVENT_ROOM_ID` (optional, defaults to 'event')

## ✅ Code Quality

- [ ] No linting errors (`npm run lint`)
- [ ] Application builds successfully (`npm run build`)
- [ ] All TypeScript errors resolved
- [ ] No console errors in development mode

## ✅ Testing Locally

- [ ] Homepage loads correctly
- [ ] Viewer registration works
  - [ ] Email validation
  - [ ] Display name validation
  - [ ] Data persists in localStorage
- [ ] Stream page loads
- [ ] Chat functionality works
  - [ ] Messages send
  - [ ] Messages display
  - [ ] Display name shows correctly
  - [ ] Rate limiting works
- [ ] Admin login works (`/admin/login`)
- [ ] Admin panel functions (`/admin`)
  - [ ] Stream control
  - [ ] Poll creation
  - [ ] Message management

## ✅ Security

- [ ] No API keys or secrets in code
- [ ] `.env.local` is in `.gitignore`
- [ ] Admin password is strong
- [ ] SESSION_SECRET is random and secure
- [ ] Service role key is only used server-side

## ✅ Vercel Configuration

- [ ] `vercel.json` exists and is correct
- [ ] `package.json` has correct scripts:
  - [ ] `build`
  - [ ] `start`
  - [ ] `dev`
- [ ] No hardcoded localhost URLs in code
- [ ] All routes use relative paths

## ✅ Post-Deployment Tasks

- [ ] Verify homepage loads
- [ ] Test full user registration flow
- [ ] Test chat with multiple browser windows
- [ ] Test admin login
- [ ] Create test poll
- [ ] Verify realtime updates work
- [ ] Check browser console for errors
- [ ] Test on mobile device
- [ ] Set up custom domain (if applicable)

## 🚀 Ready to Deploy!

Once all items are checked, you're ready to deploy:

```bash
# Option 1: Via Vercel Dashboard
# Go to https://vercel.com/new and import your GitHub repo

# Option 2: Via CLI
vercel login
vercel --prod
```

## 📝 Notes

- First deployment may take 2-5 minutes
- Preview deployments are created for every PR
- Production deployments happen on every push to main
- Environment variables can be updated in Vercel dashboard
- After updating env vars, redeploy for changes to take effect

