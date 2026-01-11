# Step-by-Step Deployment Guide: GitHub + Railway

This guide will walk you through pushing your code to GitHub and deploying to Railway.

## Part 1: Push Code to GitHub

### Step 1: Check Your Current Status

Your code is already in a git repository. Let's verify everything is ready:

```powershell
# Check current status
git status
```

### Step 2: Create a GitHub Repository

1. **Go to GitHub**: Open [github.com](https://github.com) and sign in
2. **Create New Repository**:
   - Click the "+" icon in the top right
   - Select "New repository"
   - Repository name: `MannysToolBox` (or your preferred name)
   - Description: "Construction Estimate Comparison Tool"
   - Set to **Private** (recommended) or Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

3. **Copy the repository URL** - GitHub will show you something like:
   - HTTPS: `https://github.com/YOUR_USERNAME/MannysToolBox.git`
   - Or SSH: `git@github.com:YOUR_USERNAME/MannysToolBox.git`

### Step 3: Add GitHub Remote and Push

Run these commands in PowerShell (replace YOUR_USERNAME with your GitHub username):

```powershell
# Navigate to your project directory (if not already there)
cd C:\Users\esdlr\AndroidStudioProjects\MannysToolBox

# Add all changes
git add .

# Commit your changes
git commit -m "Initial commit - Ready for Railway deployment"

# Add GitHub as remote (replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/MannysToolBox.git

# Push to GitHub (first time)
git push -u origin master
```

**Note**: If your default branch is `main` instead of `master`, use:
```powershell
git push -u origin main
```

If prompted for credentials:
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your GitHub password)
  - Create one at: https://github.com/settings/tokens
  - Click "Generate new token (classic)"
  - Select scope: `repo` (full control)
  - Copy the token and use it as your password

### Step 4: Verify Push

1. Go to your GitHub repository page
2. You should see all your files there
3. Verify that `.env` is NOT in the repository (it should be ignored)

---

## Part 2: Deploy to Railway

### Step 5: Create Railway Account and Project

1. **Sign up for Railway**:
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Select "Login with GitHub"
   - Authorize Railway to access your GitHub account

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Find and select your `MannysToolBox` repository
   - Railway will automatically detect it's a Next.js project

3. **Railway will start deploying** - This will fail initially (we need to set up the database first)

### Step 6: Add PostgreSQL Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL database
4. Once created, click on the PostgreSQL service
5. Go to the **"Variables"** tab
6. Copy the `DATABASE_URL` value (you'll need it in the next step)

### Step 7: Configure Environment Variables

1. Go back to your **main app service** (not the database)
2. Click on the service name
3. Go to the **"Variables"** tab
4. Click **"+ New Variable"** and add each of these:

   | Variable Name | Value | Notes |
   |--------------|-------|-------|
   | `DATABASE_URL` | (paste from PostgreSQL service) | Railway may auto-add this |
   | `NEXTAUTH_URL` | `https://YOUR_PROJECT_NAME.railway.app` | Get this from Railway domain, or use your custom domain |
   | `NEXTAUTH_SECRET` | (generate secret - see below) | Generate a new secret |
   | `OPENAI_API_KEY` | (your OpenAI API key) | From your local .env file |
   | `OPENAI_MODEL` | `gpt-4o-mini` | Or your preferred model |
   | `NODE_ENV` | `production` | Railway may set this automatically |

#### Generate NEXTAUTH_SECRET:

Run this in PowerShell:
```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))
```

Copy the output and use it as your `NEXTAUTH_SECRET` value.

### Step 8: Get Your Railway Domain

1. In your Railway app service, go to the **"Settings"** tab
2. Find **"Domains"** section
3. Railway will assign a domain like: `mannys-toolbox-production.up.railway.app`
4. Copy this domain
5. Go back to **"Variables"** and update `NEXTAUTH_URL`:
   ```
   https://mannys-toolbox-production.up.railway.app
   ```
   (Replace with your actual Railway domain)

### Step 9: Trigger Deployment

1. Railway should automatically redeploy when you add environment variables
2. If not, go to the **"Deployments"** tab
3. Click the **"..."** menu on the latest deployment
4. Select **"Redeploy"**

### Step 10: Monitor Build

1. Watch the build logs in the **"Deployments"** tab
2. The build should:
   - Install dependencies
   - Run Prisma generate
   - Build Next.js application
   - Start the server

3. If there are errors, check the logs and fix issues

### Step 11: Initialize Database Schema

After the first successful deployment:

1. Go to your Railway app service
2. Click on the **"Deployments"** tab
3. Find a successful deployment
4. Click on it to open logs
5. Look for any Prisma errors

Or, you can run database migrations manually:

1. Go to your app service
2. Open the **"Deployments"** tab
3. Click on the latest deployment
4. In the terminal/console, run:
   ```bash
   npm run db:push
   ```

### Step 12: Initialize Super Admin Account

After deployment, you need to create your Super Admin account:

**Option A: Using Railway's Console (Recommended)**

1. In Railway, go to your app service
2. Go to **"Deployments"** → Select latest deployment
3. Open the terminal/console
4. Run:
   ```bash
   npm run init:admin
   ```

**Option B: Using API Route**

1. Visit: `https://YOUR_RAILWAY_DOMAIN/api/admin/init-super-admin`
2. Make a POST request (you can use Postman or curl)
3. This will create the Super Admin account

### Step 13: Test Your Deployment

1. Visit your Railway domain: `https://YOUR_RAILWAY_DOMAIN`
2. You should see your homepage
3. Try signing up (should create a pending user)
4. Sign in as Super Admin: `enmaeladio@gmail.com` / `En220193`
5. Go to `/admin/approvals` to approve users

---

## Troubleshooting

### Build Fails

- Check the build logs in Railway
- Make sure all environment variables are set correctly
- Verify `DATABASE_URL` is correct
- Check that `NEXTAUTH_SECRET` is set

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Make sure PostgreSQL service is running
- Check that the database is linked to your app service

### Application Crashes

- Check the deployment logs
- Verify all environment variables are set
- Make sure the build completed successfully

### Can't Sign In

- Verify `NEXTAUTH_URL` matches your Railway domain
- Check that `NEXTAUTH_SECRET` is set
- Make sure database migrations ran successfully

---

## Next Steps After Deployment

1. **Set up Custom Domain** (optional):
   - In Railway, go to Settings → Domains
   - Add your custom domain
   - Update DNS records as instructed
   - Update `NEXTAUTH_URL` to match your custom domain

2. **Set up File Storage**:
   - Currently using local file storage (won't persist on Railway)
   - Consider: Railway Volumes, AWS S3, or Cloudinary
   - See `RAILWAY_DEPLOYMENT.md` for details

3. **Monitor Usage**:
   - Check Railway dashboard for resource usage
   - Monitor database size
   - Watch for any errors in logs

---

## Quick Command Reference

```powershell
# Git commands
git status                          # Check status
git add .                           # Stage all changes
git commit -m "Your message"        # Commit changes
git push origin master              # Push to GitHub (or 'main' if that's your branch)

# Railway environment variables (set in Railway dashboard, not terminal)
DATABASE_URL=<from-postgres-service>
NEXTAUTH_URL=https://your-domain.railway.app
NEXTAUTH_SECRET=<generated-secret>
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
```

---

Good luck with your deployment! 🚀
