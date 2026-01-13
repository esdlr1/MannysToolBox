# Push Database Schema to Railway

## ⚠️ Error: "relation 'users' does not exist"

This means the database tables haven't been created in Railway's database yet.

---

## ✅ Solution: Push Schema to Railway

### Option 1: Railway Auto-Deploy (Recommended)

Railway should automatically run `npm run build` which includes Prisma generate, but you need to push the schema.

**Check if Railway has the schema:**
1. Railway → MannysToolBox → Deployments
2. Check latest deployment logs
3. Look for "Prisma" or "db:push" messages

**If schema wasn't pushed:**
- Railway might need the schema pushed manually
- Or the build process needs to include schema push

### Option 2: Push Schema via Railway CLI

1. **Install Railway CLI:**
   ```powershell
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```powershell
   railway login
   ```

3. **Link to your project:**
   ```powershell
   railway link
   ```

4. **Push schema:**
   ```powershell
   railway run npm run db:push
   ```

### Option 3: Use Railway's Database Console (SQL)

Instead of pushing schema, create tables manually via SQL in Railway's database console.

---

## 🔧 Quick Fix: Create Tables via SQL

Since you're in pgAdmin, you're connected to your **local database**. You need to:

1. **Get Railway's database connection details**
2. **Connect to Railway's database in pgAdmin**
3. **Run the schema creation SQL**

OR

**Use Railway's built-in database console** (easier):

1. **Railway → Postgres → Data/Query tab**
2. **Run the table creation SQL** (see below)

---

## 📝 Create Tables SQL for Railway

Run this in **Railway's database console** (not local pgAdmin):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Create other required tables (simplified - check schema.prisma for full list)
-- Add other tables as needed from your Prisma schema
```

---

## ✅ Better Solution: Push Schema Properly

The best approach is to ensure Railway runs the schema push during deployment.

**Check your Railway build settings:**
1. Railway → MannysToolBox → Settings
2. Check "Build Command" - should include Prisma
3. Or add to `package.json` scripts

**Or manually trigger:**
- Railway → MannysToolBox → Deployments
- Click "Redeploy" or trigger a new deployment

---

## 🎯 Recommended Steps

1. **Check Railway deployment logs** - see if schema was pushed
2. **If not, use Railway CLI** to push schema: `railway run npm run db:push`
3. **OR use Railway's database console** to create tables via SQL
4. **Then create the admin user** using the SQL I provided earlier

---

## 📋 Quick Checklist

- [ ] Schema pushed to Railway database
- [ ] Tables exist (users, profiles, etc.)
- [ ] Can run the admin creation SQL
- [ ] Admin user created
- [ ] Can log in
