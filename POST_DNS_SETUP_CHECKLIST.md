# Post-DNS Setup Checklist

## ✅ DNS Configuration Complete!

Your Cloudflare DNS is now properly configured:
- ✅ Root domain (@) → Railway
- ✅ WWW subdomain → Railway  
- ✅ Wildcard (*) → Railway

---

## Next Steps (After DNS Propagation)

### Step 1: Wait for DNS Propagation ⏰

- **Time**: 5-30 minutes (can take up to 48 hours)
- **Check**: Railway → Settings → Networking
- **Status**: Should change from "Waiting for DNS update" to "Valid" ✅

### Step 2: Verify Domains in Railway

1. Go to Railway → MannysToolBox service → Settings → Networking
2. Check domain status:
   - `mannystoolbox.com` → Should show "Valid" ✅
   - `www.mannystoolbox.com` → Should show "Valid" (if added) ✅

### Step 3: Enable Cloudflare Proxy (Optional)

**After Railway verifies domains:**

1. Go to Cloudflare → DNS → Records
2. For each CNAME record (@, www, *):
   - Click the **gray cloud** icon
   - It should turn **orange** (Proxied)
   - Benefits: CDN, DDoS protection, faster loading

**Or keep them gray (DNS only)** - both work fine!

### Step 4: Update Railway Environment Variables

1. Go to Railway → MannysToolBox service → Variables
2. Update **NEXTAUTH_URL**:
   - **Old**: `https://mannystoolbox-production.up.railway.app`
   - **New**: `https://mannystoolbox.com`
3. Railway will automatically redeploy

### Step 5: Test Your Domains

Test all your domains:

- ✅ `https://mannystoolbox.com` → Should load homepage
- ✅ `https://www.mannystoolbox.com` → Should load homepage
- ✅ `https://estimate-comparison.mannystoolbox.com` → Should load tool
- ✅ Any new tool subdomain → Should work automatically

### Step 6: Initialize Database (If Not Done)

After Railway deployment succeeds:

1. Go to Railway → Deployments → Latest deployment
2. Open terminal/console
3. Run: `npm run db:push`
4. This creates all database tables

### Step 7: Initialize Super Admin

**Option A: Using Railway Console**

1. Go to Railway → Deployments → Latest deployment
2. Open terminal/console
3. Run: `npm run init:admin`

**Option B: Using API Route**

1. Visit: `https://mannystoolbox.com/api/admin/init-super-admin`
2. Make a POST request (use Postman, curl, or browser dev tools)
3. This creates Super Admin: `enmaeladio@gmail.com` / `En220193`

### Step 8: Test Full Application

1. **Homepage**: Visit `https://mannystoolbox.com`
   - Should see logo and tool dropdown ✅

2. **Sign Up**: Create a test account
   - Should create pending user (if Owner/Manager) ✅

3. **Sign In as Super Admin**:
   - Email: `enmaeladio@gmail.com`
   - Password: `En220193`
   - Should work ✅

4. **Admin Approvals**: Visit `/admin/approvals`
   - Should see pending users ✅
   - Can approve/deny users ✅

5. **Tool Access**: Visit `https://estimate-comparison.mannystoolbox.com`
   - Should load Estimate Comparison Tool ✅

---

## Monitoring & Maintenance

### Check Railway Deployment

- Go to Railway → Deployments tab
- Monitor build logs for any errors
- Check that app is "Online"

### Check Cloudflare

- Go to Cloudflare Dashboard
- Monitor traffic and performance
- Check SSL/TLS status (should be "Full" or "Full strict")

### Database

- Railway provides PostgreSQL database
- Check database size and connections
- Monitor for any connection issues

---

## Troubleshooting

### Domain Not Working

1. **Check DNS Propagation**:
   - Visit: https://www.whatsmydns.net
   - Enter your domain
   - Should show Railway's IP/domain

2. **Check Railway Status**:
   - Railway → Settings → Networking
   - Domain should show "Valid"

3. **Check Cloudflare Proxy**:
   - If using orange cloud (Proxied), try gray cloud (DNS only)
   - Wait and retry

### SSL Certificate Issues

1. **In Cloudflare**:
   - SSL/TLS → Overview
   - Set to "Full" or "Full (strict)"
   - Wait for Railway to provision SSL

2. **Clear Browser Cache**:
   - Hard refresh (Ctrl+Shift+R)
   - Or clear cache completely

### Tool Subdomain Not Working

1. **Verify Wildcard DNS**:
   - Check Cloudflare has `*` CNAME record
   - Points to Railway domain

2. **Check Middleware**:
   - Verify tool is registered in `lib/tools.ts`
   - Check middleware.ts is routing correctly

3. **Test DNS Resolution**:
   - `nslookup tool-name.mannystoolbox.com`
   - Should resolve to Railway

---

## Summary

✅ **DNS Setup**: Complete
✅ **Wildcard DNS**: Configured for all tools
✅ **Railway Deployment**: Ready
⏰ **Next**: Wait for DNS propagation, then verify in Railway

**You're all set!** Once Railway verifies the domains, your application will be live at `https://mannystoolbox.com` with all tool subdomains working! 🚀

---

## Quick Reference

- **Main Domain**: `https://mannystoolbox.com`
- **WWW**: `https://www.mannystoolbox.com`
- **Tool Example**: `https://estimate-comparison.mannystoolbox.com`
- **Railway Domain**: `https://mannystoolbox-production.up.railway.app` (backup)
- **Super Admin**: `enmaeladio@gmail.com` / `En220193`
