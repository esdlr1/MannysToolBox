# Fix: Push Schema to Railway Database

## ⚠️ Problem

The error "relation 'users' does not exist" means Railway's database doesn't have the tables yet.

Railway's build runs `prisma generate` but **NOT** `prisma db push`.

---

## ✅ Solution 1: Update Railway Build Command (Recommended)

I've updated `railway.json` to include `prisma db push` in the build.

**Next steps:**
1. **Commit and push** the updated `railway.json`:
   ```powershell
   git add railway.json
   git commit -m "Add prisma db push to Railway build"
   git push
   ```

2. **Railway will auto-deploy** and push the schema

3. **Wait 2-3 minutes** for deployment

4. **Then create the admin user** using the SQL

---

## ✅ Solution 2: Push Schema Manually via Railway CLI

1. **Install Railway CLI:**
   ```powershell
   npm install -g @railway/cli
   ```

2. **Login:**
   ```powershell
   railway login
   ```

3. **Link to project:**
   ```powershell
   railway link
   ```

4. **Push schema:**
   ```powershell
   railway run npm run db:push
   ```

---

## ✅ Solution 3: Use Railway Database Console (Quick Fix)

1. **Railway → Postgres → Data/Query tab**
2. **Open SQL editor**
3. **Run this SQL** to create the `users` table:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT NOT NULL,
    role TEXT,
    "isApproved" BOOLEAN DEFAULT false,
    "emailVerified" TIMESTAMP,
    image TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    avatar TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

4. **Then run the admin creation SQL** from `docs/RAILWAY_SQL_CREATE_ADMIN.sql`

---

## 🎯 Recommended: Update railway.json

I've created/updated `railway.json` to include `prisma db push` in the build process.

**Just commit and push:**
```powershell
git add railway.json
git commit -m "Add prisma db push to build"
git push
```

Railway will automatically:
1. Run `prisma generate`
2. Run `prisma db push` (creates tables)
3. Run `next build`
4. Deploy

---

## 📋 After Schema is Pushed

Once tables exist in Railway:
1. ✅ Run the admin creation SQL
2. ✅ Log in at https://mannystoolbox.com
3. ✅ Email: `enmaeladio@gmail.com`
4. ✅ Password: `En220193`

---

## 🆘 If Still Having Issues

Check Railway deployment logs:
- Railway → MannysToolBox → Deployments
- Click latest deployment
- Check logs for "Prisma" or "db push" messages
- Look for any errors
