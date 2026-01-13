# Fix Railway DATABASE_URL Authentication Error

## ⚠️ Problem

Railway service can't connect to database because `DATABASE_URL` has wrong credentials.

---

## ✅ Solution: Copy DATABASE_URL from Postgres Service

### Step-by-Step:

1. **Go to Railway Dashboard**
2. **Click on your Postgres service** (the elephant icon, not MannysToolBox)
3. **Click "Variables" tab**
4. **Find `DATABASE_URL`** - you'll see the full connection string
5. **Click the eye icon** to reveal the value (if hidden)
6. **Copy the entire DATABASE_URL value**

7. **Now go to MannysToolBox service**
8. **Click "Variables" tab**
9. **Find `DATABASE_URL`**
10. **Click the three dots (⋮) on the right → "Edit"**
11. **Paste the DATABASE_URL you copied from Postgres service**
12. **Click "Save" or "Update"**

13. **Railway will automatically restart** the MannysToolBox service
14. **Wait 1-2 minutes** for restart
15. **Check logs** - should see "Ready" instead of authentication errors

---

## 🔍 Verify DATABASE_URL Format

The DATABASE_URL should look like:
```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

**Important:**
- Username: `postgres`
- Host: `postgres.railway.internal`
- Port: `5432`
- Database: `railway` (or your database name)
- Password: Should match Postgres service password

---

## 🆘 If Still Not Working

### Option 1: Check Postgres Service Status
- Make sure Postgres service is "Online"
- If not, restart it

### Option 2: Regenerate Postgres Password
- Railway → Postgres → Settings
- Look for "Reset Password" or "Regenerate"
- This creates a new DATABASE_URL
- Copy the new one to MannysToolBox

### Option 3: Use Shared Variables
- Railway → MannysToolBox → Variables
- Click "Shared Variable"
- Select `DATABASE_URL` from Postgres service
- This automatically syncs the value

---

## ✅ After Fixing

Once DATABASE_URL is correct:
- ✅ Service will start successfully
- ✅ No more authentication errors
- ✅ App will be accessible
- ✅ You can log in

---

## 📝 Quick Checklist

- [ ] Copied DATABASE_URL from Postgres service
- [ ] Updated DATABASE_URL in MannysToolBox service
- [ ] Service restarted automatically
- [ ] Checked logs - no more auth errors
- [ ] App is accessible

---

## 💡 Pro Tip: Use Shared Variables

Instead of copying, you can use Railway's "Shared Variable" feature:
1. Railway → MannysToolBox → Variables
2. Click "Shared Variable" button
3. Select `DATABASE_URL` from Postgres service
4. This keeps them in sync automatically!
