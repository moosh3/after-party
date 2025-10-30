# Deploying After Party to Vercel

This guide will walk you through deploying your After Party livestream application to Vercel.

## Prerequisites

1. A GitHub account with this repository pushed
2. A [Vercel account](https://vercel.com/signup) (free tier works!)
3. A Supabase project (already set up)
4. A Mux account with API credentials (if using video streaming)

## Environment Variables Required

Before deploying, you'll need to set these environment variables in Vercel:

### Supabase (Required)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep secret!)

### Mux Video (Required for streaming)
- `MUX_TOKEN_ID` - Your Mux API token ID
- `MUX_TOKEN_SECRET` - Your Mux API token secret
- `MUX_SIGNING_KEY_ID` - Your Mux signing key ID
- `MUX_SIGNING_KEY_PRIVATE` - Your Mux signing key private key

### Application Configuration (Required)
- `SESSION_SECRET` - Random secret string for session encryption (generate a secure random string)
- `ADMIN_PASSWORD_HASH` - Bcrypt hash of your admin password (use `npm run generate-admin-hash`)

### Optional
- `NEXT_PUBLIC_EVENT_DATE` - Event date for display
- `EVENT_ROOM_ID` - Default: 'event'

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Project"
   - Select your GitHub repository
   - Vercel will auto-detect Next.js configuration

3. **Configure Environment Variables**
   - In the deployment configuration screen, expand "Environment Variables"
   - Add all required environment variables from the list above
   - Make sure to mark sensitive variables (tokens, secrets) appropriately

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application
   - You'll get a live URL like `https://your-app.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Link to existing project or create new one

4. **Add Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   # ... add all other variables
   ```

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## Post-Deployment Configuration

### 1. Set up Supabase Database

If you haven't already set up your database:

```bash
# Run the setup script (locally, pointing to your production Supabase)
npm run setup:db
```

Or manually run the SQL files in Supabase SQL Editor:
- `sql/001_schema.sql` - Database schema
- `sql/002_realtime_triggers.sql` - Realtime triggers
- `sql/003_enable_realtime.sql` - Enable realtime features

### 2. Configure Supabase Authentication

In your Supabase project dashboard:
1. Go to Authentication > URL Configuration
2. Add your Vercel URL to **Site URL**: `https://your-app.vercel.app`
3. Add to **Redirect URLs**:
   - `https://your-app.vercel.app/**`

### 3. Configure CORS (if needed)

In your Supabase project:
1. Go to Settings > API
2. Ensure your Vercel domain is allowed

### 4. Generate Admin Password Hash

Before first use, generate your admin password hash:

```bash
npm run generate-admin-hash
```

Then add the hash to Vercel environment variables as `ADMIN_PASSWORD_HASH`.

### 5. Verify Deployment

1. Visit your Vercel URL
2. Try registering as a viewer with email and display name
3. Check that chat functionality works
4. Test admin login at `/admin/login`

## Custom Domain (Optional)

1. Go to your project in Vercel Dashboard
2. Settings > Domains
3. Add your custom domain
4. Follow DNS configuration instructions
5. Update Supabase URL configuration with new domain

## Environment Variables Management

### View Variables
```bash
vercel env ls
```

### Update a Variable
```bash
vercel env rm VARIABLE_NAME
vercel env add VARIABLE_NAME
```

### Pull Variables Locally
```bash
vercel env pull .env.local
```

## Troubleshooting

### Build Fails
- Check the build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility (Vercel uses Node 18+ by default)

### Environment Variables Not Working
- Make sure variables are set for the correct environment (Production, Preview, Development)
- Redeploy after adding/updating environment variables
- Client-side variables must be prefixed with `NEXT_PUBLIC_`

### Supabase Connection Issues
- Verify Supabase URL and keys are correct
- Check Supabase is not rate limiting requests
- Ensure Realtime is enabled in Supabase dashboard

### Admin Login Not Working
- Verify `ADMIN_PASSWORD_HASH` is set correctly
- Check `SESSION_SECRET` is configured
- Ensure cookies are enabled in browser

## Vercel-Specific Features

### Automatic Deployments
- Every push to `main` branch triggers a production deployment
- Pull requests get preview deployments automatically

### Preview Deployments
- Each PR gets its own unique URL
- Perfect for testing before merging

### Analytics
- Enable Vercel Analytics in project settings for visitor insights
- Free tier includes basic analytics

### Performance Monitoring
- Vercel automatically monitors your app's performance
- View metrics in the deployment dashboard

## Cost Considerations

**Vercel Free Tier Includes:**
- Unlimited personal projects
- 100GB bandwidth per month
- Serverless function executions
- Automatic HTTPS

**Watch out for:**
- Bandwidth usage (if you have many concurrent viewers)
- Serverless function execution time
- Consider upgrading to Pro if you exceed free tier limits

**Supabase Free Tier Includes:**
- 500MB database space
- 5GB bandwidth
- 2GB file storage

## Security Best Practices

1. **Never commit secrets** - Use environment variables only
2. **Rotate keys regularly** - Especially after team member changes
3. **Use service role key carefully** - Only on server-side API routes
4. **Enable Vercel's security features** - HTTPS, DDoS protection
5. **Monitor usage** - Watch for unusual activity in Vercel/Supabase dashboards

## Continuous Deployment Workflow

```bash
# Develop locally
npm run dev

# Test your changes
# Commit and push to feature branch
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Vercel creates preview deployment automatically
# Review preview deployment
# Merge to main when ready
# Production deployment happens automatically
```

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Supabase Documentation](https://supabase.com/docs)

## Quick Reference

```bash
# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# Open project in browser
vercel open

# View project in Vercel dashboard
vercel inspect
```

---

Your After Party app is now live on Vercel! 🎉

