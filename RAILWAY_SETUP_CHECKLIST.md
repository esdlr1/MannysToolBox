# Railway Setup Checklist

## ✅ Completed Steps
- [x] GitHub repository pushed
- [x] Railway project created
- [x] PostgreSQL database added
- [x] DATABASE_URL automatically set
- [x] App is building

## 📋 Next Steps

### Step 1: Generate Public Domain (Do this now!)
1. In Railway Settings tab, find **"Public Networking"** section
2. Click **"Generate Domain"** button (lightning bolt icon)
3. Railway will create a domain like: `mannys-toolbox-production.up.railway.app`
4. **Copy this domain** - you'll need it for `NEXTAUTH_URL`

### Step 2: Add Environment Variables
Go to **Variables** tab and click **"+ New Variable"** for each:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | ✅ Already set | Railway auto-added from Postgres service |
| `NEXTAUTH_URL` | `https://YOUR_DOMAIN.railway.app` | Use the domain from Step 1 |
| `NEXTAUTH_SECRET` | `MGIzNDQzOWQtYmFhNS00MzFjLWJlODItODI0MmM4M2I1NmJl` | Generated secret (saved in NEXTAUTH_SECRET.txt) |
| `OPENAI_API_KEY` | `your-api-key-here` | From your local .env file |
| `OPENAI_MODEL` | `gpt-4o-mini` | Your preferred model |
| `NODE_ENV` | `production` | Required for production |

### Step 3: Monitor Build
1. Go to **Deployments** tab
2. Watch the build logs
3. Build should complete successfully after variables are added
4. If it fails, check logs for errors

### Step 4: Initialize Database (After build succeeds)
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **"..."** menu → **"View Logs"** or open terminal
4. Run: `npm run db:push`

**OR** use the API route after deployment:
- Visit: `https://YOUR_DOMAIN.railway.app/api/admin/init-super-admin` (POST request)

### Step 5: Initialize Super Admin
After database is initialized:

**Option A: Using Railway Console**
1. Go to **Deployments** → Latest deployment
2. Open terminal/console
3. Run: `npm run init:admin`

**Option B: Using API Route**
1. Visit: `https://YOUR_DOMAIN.railway.app/api/admin/init-super-admin`
2. Make a POST request (you can use Postman, curl, or browser dev tools)
3. This creates Super Admin: `enmaeladio@gmail.com` / `En220193`

### Step 6: Test Your Deployment
1. Visit: `https://YOUR_DOMAIN.railway.app`
2. You should see your homepage
3. Try signing up (creates pending user)
4. Sign in as Super Admin
5. Go to `/admin/approvals` to approve users

## 🔍 Current Settings Reference

**Private Networking:**
- Internal Domain: `mannystoolbox.railway.internal`
- Used for service-to-service communication within Railway

**Public Networking:**
- Generate Domain: Creates public HTTPS endpoint
- Custom Domain: Add your own domain (optional, can do later)
- TCP Proxy: For non-HTTP services (not needed here)

## ⚠️ Important Notes

1. **Build Status**: App is currently building - wait for it to complete
2. **Domain Required**: You need the public domain before setting `NEXTAUTH_URL`
3. **Auto-Redeploy**: Railway will automatically redeploy when you add environment variables
4. **Database**: Prisma will need to run migrations - do this after first successful build
5. **Secrets**: Never commit secrets to git - always use Railway's Variables

## 🐛 Troubleshooting

### Build Fails
- Check **Deployments** → **Logs** for error messages
- Verify all environment variables are set correctly
- Make sure `DATABASE_URL` is correct

### Can't Connect to Database
- Verify `DATABASE_URL` is set
- Check that Postgres service is "Online"
- Ensure database migrations ran (`npm run db:push`)

### Authentication Issues
- Verify `NEXTAUTH_URL` matches your Railway domain exactly
- Check `NEXTAUTH_SECRET` is set
- Make sure Super Admin is initialized

## 📚 Additional Resources

- See `DEPLOYMENT_GUIDE.md` for detailed deployment instructions
- See `RAILWAY_DEPLOYMENT.md` for Railway-specific details
