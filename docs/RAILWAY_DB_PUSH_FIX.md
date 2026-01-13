# Fix: Railway Database Push During Build

## ⚠️ Problem

Railway build failed because `prisma db push` can't access the database during build phase.

**Error:** `Can't reach database server at postgres.railway.internal:5432`

**Why:** The build container doesn't have access to Railway's internal network. Database connections only work at runtime.

---

## ✅ Solution: Move db push to Start Command

I've updated `railway.json` to:
- **Build:** Only `prisma generate && next build` (no database access needed)
- **Start:** `prisma db push && next start` (runs when container starts, has database access)

---

## 📋 What Changed

**Before:**
```json
"buildCommand": "prisma generate && prisma db push && next build"
```

**After:**
```json
"buildCommand": "prisma generate && next build"
"startCommand": "prisma db push && next start"
```

---

## 🚀 Next Steps

1. **Commit and push:**
   ```powershell
   git add railway.json
   git commit -m "Move prisma db push to start command"
   git push
   ```

2. **Railway will:**
   - Build successfully (no database needed)
   - On start, push schema to database
   - Then start the app

3. **Wait for deployment** (2-3 minutes)

4. **Check logs** to verify schema was pushed:
   - Railway → MannysToolBox → Deployments → Latest → Logs
   - Look for "Your database is now in sync"

---

## ✅ After Schema is Pushed

Once deployment completes and schema is pushed:

1. **Create admin user** using SQL in Railway's database console
2. **Or use the API route** `/api/admin/init-super-admin` (POST request)

---

## 🧪 Verify Schema Was Pushed

Check Railway logs for:
```
✔ Your database is now in sync with your Prisma schema
```

If you see this, the schema is pushed and you can create the admin user!

---

## 📝 Alternative: Use Migrations (Future)

For production, consider using Prisma Migrations instead of `db push`:
- More control over schema changes
- Better for production environments
- Can be run separately

But for now, `db push` in the start command works fine!
