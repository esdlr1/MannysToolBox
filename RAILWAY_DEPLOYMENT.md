# Railway Deployment Guide

## Pre-Deployment Checklist

Before deploying to Railway, ensure the following are completed:

### ✅ Database Setup
- [x] Database schema is finalized (includes `isApproved` field)
- [ ] Run `npm run db:push` locally to test schema migration
- [ ] Super Admin initialization script created

### ✅ Environment Variables
Ensure all required environment variables are ready:

- `DATABASE_URL` - Will be provided by Railway PostgreSQL service
- `NEXTAUTH_URL` - Your production URL (e.g., `https://www.mannystoolbox.com`)
- `NEXTAUTH_SECRET` - Generate a new secret for production
- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - `gpt-4o-mini` (or your preferred model)
- `NODE_ENV` - Set to `production` (Railway will set this automatically)

### ✅ Code Readiness
- [x] All features implemented
- [x] No critical bugs
- [x] Error handling in place
- [ ] Test locally with `npm run build`

### ✅ File Storage
- Currently using local `uploads/` directory
- **IMPORTANT**: For production, you'll need to configure persistent storage
- Options: Railway Volumes, AWS S3, or Cloudinary

## Deployment Steps

### Step 1: Prepare Repository

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "Ready for Railway deployment"
   git push origin main
   ```

2. **Generate production NEXTAUTH_SECRET**:
   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))

   # Or use openssl (if available)
   openssl rand -base64 32
   ```
   Save this secret - you'll need it for Railway environment variables.

### Step 2: Create Railway Project

1. **Sign up/Login to Railway**:
   - Go to [railway.app](https://railway.app)
   - Sign up or log in with GitHub

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select the `MannysToolBox` repository
   - Railway will detect the `railway.json` configuration

### Step 3: Add PostgreSQL Database

1. **Add PostgreSQL Service**:
   - In your Railway project, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will automatically create a PostgreSQL instance
   - Copy the `DATABASE_URL` from the PostgreSQL service variables

### Step 4: Configure Environment Variables

In Railway dashboard, go to your app service → Variables tab:

Add these variables:

```env
DATABASE_URL=<copied-from-postgresql-service>
NEXTAUTH_URL=https://www.mannystoolbox.com
NEXTAUTH_SECRET=<your-generated-secret-from-step-1>
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
```

**Note**: Railway will automatically set `DATABASE_URL` if you linked the PostgreSQL service.

### Step 5: Update Build Command (if needed)

Railway should automatically use the build command from `railway.json`:
- Build: `npm run build` (includes `prisma generate`)
- Start: `npm start`

### Step 6: Configure Custom Domain

1. **Add Custom Domain in Railway**:
   - Go to your app service → Settings → Domains
   - Add custom domain: `www.mannystoolbox.com`
   - Railway will provide DNS records to configure

2. **Configure DNS Records**:
   - In your domain registrar (where you bought `mannystoolbox.com`):
   - Add CNAME record: `www` → Railway provided domain
   - Add wildcard CNAME: `*` → Railway provided domain (for subdomains)
   - **OR** Add A record pointing to Railway's IP (Railway will provide)

3. **SSL Certificate**:
   - Railway automatically provisions SSL certificates
   - Once DNS propagates, HTTPS will be enabled

### Step 7: Run Database Migrations

After first deployment:

1. **Generate Prisma Client**:
   Railway should do this automatically during build, but you can verify in logs.

2. **Run Database Schema**:
   You have two options:

   **Option A: Via Railway CLI** (Recommended)
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Link to your project
   railway link
   
   # Run migrations
   railway run npm run db:push
   ```

   **Option B: Via Railway Dashboard**
   - Go to your app → Deployments
   - Open a terminal session
   - Run: `npm run db:push`

3. **Initialize Super Admin**:
   ```bash
   # Via Railway CLI
   railway run npm run init:admin
   
   # Or via Railway dashboard terminal
   npm run init:admin
   ```

### Step 8: Configure File Storage (IMPORTANT)

Current setup uses local file storage which won't persist on Railway. You need to:

**Option A: Railway Volumes** (Easiest)
1. In Railway, add a Volume service
2. Mount it to `/uploads` in your app
3. Update `app/api/upload/route.ts` to use the volume path

**Option B: AWS S3** (Recommended for production)
- Set up S3 bucket
- Install `@aws-sdk/client-s3`
- Update upload/download routes to use S3

**Option C: Cloudinary** (Simple for images/PDFs)
- Set up Cloudinary account
- Install `cloudinary`
- Update upload routes

**For now, you can deploy and configure storage later, but uploaded files will be lost on redeploy.**

### Step 9: Monitor Deployment

1. **Check Build Logs**:
   - Railway dashboard → Deployments → View logs
   - Ensure build completes successfully
   - Check for any errors

2. **Check Runtime Logs**:
   - After deployment, monitor logs for errors
   - Test the application

3. **Verify Environment Variables**:
   - Double-check all variables are set correctly

## Post-Deployment Tasks

### 1. Test Everything

- [ ] Sign up as Employee (should work immediately)
- [ ] Sign up as Owner (should require approval)
- [ ] Sign in as Super Admin (`Enmaeladio@gmail.com`)
- [ ] Approve a test Owner/Manager account
- [ ] Test Estimate Comparison Tool
- [ ] Test file uploads/downloads
- [ ] Test all navigation and routing

### 2. Set Up Monitoring (Optional)

- Railway provides basic logs
- Consider adding error tracking (Sentry, LogRocket, etc.)

### 3. Performance Optimization

- Enable Railway's CDN (if available)
- Configure caching headers in Next.js
- Optimize images and assets

## Troubleshooting

### Build Fails

**Error: Prisma Client not generated**
- Solution: Ensure `DATABASE_URL` is set correctly
- Check build logs for Prisma errors

**Error: Module not found**
- Solution: Check `package.json` dependencies
- Ensure all dependencies are in `dependencies`, not `devDependencies`

### Runtime Errors

**Database Connection Issues**
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running in Railway
- Verify database schema is pushed: `railway run npm run db:push`

**Authentication Not Working**
- Verify `NEXTAUTH_URL` matches your domain
- Check `NEXTAUTH_SECRET` is set
- Verify cookies are working (check browser console)

**File Uploads Not Working**
- Check if uploads directory exists and is writable
- Consider switching to cloud storage (S3, Cloudinary)

## Quick Deploy Commands

Once Railway is set up, future deployments are automatic via Git:

```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main

# Railway will automatically:
# 1. Detect the push
# 2. Build the app
# 3. Deploy to production
```

## Railway CLI Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Open shell in Railway environment
railway shell

# Run commands in Railway environment
railway run npm run db:push
railway run npm run init:admin
```

## Important Notes

1. **Never commit `.env` file** - Use Railway environment variables
2. **Database backups** - Railway PostgreSQL includes automatic backups
3. **Costs** - Monitor Railway usage to avoid unexpected charges
4. **File storage** - Implement cloud storage before going fully live
5. **Domain SSL** - Railway handles SSL automatically, but DNS must be configured correctly

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: Check GitHub issues or create new ones
