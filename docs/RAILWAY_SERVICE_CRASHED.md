# Fix: Railway Service Crashed

## ⚠️ Status

Your MannysToolBox service shows: **"Crashed 1 hour ago"**

The DATABASE_URL looks correct, so the crash might be from a different issue.

---

## ✅ Quick Fix: Restart Service

1. **Railway → MannysToolBox service**
2. **Click the three dots (⋮) menu** (top right of service card)
3. **Click "Restart"** or **"Redeploy"**
4. **Wait 1-2 minutes** for restart

---

## 🔍 Check Logs to Find Cause

1. **Railway → MannysToolBox → Logs tab**
2. **Scroll to the bottom** (most recent errors)
3. **Look for:**
   - Red error messages
   - Stack traces
   - "Error:" or "Failed:" messages

Common crash causes:
- Database connection issues (even with correct URL)
- Missing environment variables
- Build/startup errors
- Out of memory
- Port conflicts

---

## 🔧 If Restart Doesn't Work

### Check Recent Changes
- Did you recently update `railway.json`?
- Did you add/remove environment variables?
- Did the build succeed?

### Verify Environment Variables
Make sure all required variables are set:
- ✅ `DATABASE_URL` (looks correct)
- ✅ `NEXTAUTH_SECRET`
- ✅ `NEXTAUTH_URL`
- ✅ `RESEND_API_KEY` (should be uppercase: `RESEND_API_KEY`)
- ✅ `EMAIL_FROM`
- ✅ `OPENAI_API_KEY` (if using AI features)
- ✅ `NODE_ENV`

### Check Build Status
1. **Railway → MannysToolBox → Deployments tab**
2. **Check latest deployment:**
   - Did it build successfully?
   - Any build errors?
   - Did it deploy?

---

## 🚀 Force Redeploy

If restart doesn't work:

1. **Railway → MannysToolBox → Deployments**
2. **Click "Redeploy"** on latest deployment
   OR
3. **Make a small change and push to GitHub** (triggers auto-deploy)

---

## 📋 Troubleshooting Checklist

- [ ] Service restarted
- [ ] Checked logs for errors
- [ ] All environment variables set correctly
- [ ] Build succeeded
- [ ] DATABASE_URL is correct
- [ ] Postgres service is online
- [ ] No port conflicts

---

## 🆘 Common Issues

### "Cannot find module"
- Missing dependencies
- Run `npm install` locally and commit `package-lock.json`

### "Port already in use"
- Railway handles this automatically
- Check if another service is using the port

### "Out of memory"
- Service might need more resources
- Check Railway → Settings → Resources

### Database connection timeout
- Even with correct URL, connection might timeout
- Check Postgres service is online
- Verify network connectivity

---

## ✅ After Restart

Once service is running:
1. ✅ Check status shows "Online"
2. ✅ Visit https://mannystoolbox.com
3. ✅ Try logging in
4. ✅ Check logs for any warnings

---

## 📝 Next Steps

1. **Restart the service** (quickest fix)
2. **Check logs** if it crashes again
3. **Share the error** from logs if you need help
