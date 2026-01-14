# Connect pgAdmin 4 to Railway Database - Step by Step

## ⚠️ Important: Use PUBLIC URL, Not Internal URL

Railway has two database URLs:
- **`DATABASE_URL`**: Uses `postgres.railway.internal` - **ONLY works inside Railway's network**
- **`DATABASE_PUBLIC_URL`**: Uses a public hostname - **Works from your computer**

You **MUST** use `DATABASE_PUBLIC_URL` to connect from pgAdmin!

---

## Step 1: Get Railway Public Database URL

1. **Go to Railway Dashboard** → Your Project
2. **Click on Postgres service**
3. **Click "Variables" tab**
4. **Find `DATABASE_PUBLIC_URL`** (NOT `DATABASE_URL`)
5. **Click the eye icon** to reveal the value
6. **Copy the entire connection string**

It should look like:
```
postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:PORT/railway
```

**NOT** like this (this won't work from your computer):
```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

---

## Step 2: Parse the Connection String

Your `DATABASE_PUBLIC_URL` format:
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Example:
```
postgresql://postgres:YBfAoaOofDjQVWxfYkVaaspwZSFocyay@containers-us-west-123.railway.app:5432/railway
```

Extract these values:
- **Host**: `containers-us-west-123.railway.app` (the part between `@` and `:`)
- **Port**: `5432` (the number after the host, before `/`)
- **Database**: `railway` (the part after the last `/`)
- **Username**: `postgres` (the part before the first `:`)
- **Password**: `YBfAoaOofDjQVWxfYkVaaspwZSFocyay` (the part between `:` and `@`)

---

## Step 3: Add Railway Server in pgAdmin 4

1. **Open pgAdmin 4**
2. **Right-click** on "Servers" in the left panel
3. **Select** "Create" → "Server..."

### General Tab:
- **Name**: `Railway - MannysToolBox` (or any name you prefer)

### Connection Tab:
**IMPORTANT: Enter each value separately, NOT the full URL!**

- **Host name/address**: `containers-us-west-123.railway.app` (just the host, no `postgresql://`)
- **Port**: `5432`
- **Maintenance database**: `railway` (the database name)
- **Username**: `postgres`
- **Password**: `YBfAoaOofDjQVWxfYkVaaspwZSFocyay` (the password from the URL)
- **Save password?**: ✅ Check this box (so you don't have to enter it each time)

### SSL Tab:
- **SSL mode**: `require` (Railway requires SSL for public connections)

### Click "Save"

---

## Step 4: Connect and Verify

1. **Expand** the new "Railway - MannysToolBox" server in the left panel
2. **Enter the password** if prompted
3. **Expand** "Databases"
4. **Find** the `railway` database
5. **Right-click** on `railway` → **Query Tool**

### Test Connection:
Run this query:
```sql
SELECT current_database(), current_user;
```

You should see:
- `current_database`: `railway`
- `current_user`: `postgres`

---

## Step 5: Run the Admin Creation SQL

1. **Right-click** on `railway` database → **Query Tool**
2. **Copy** the SQL from `docs/RAILWAY_SQL_CREATE_ADMIN.sql`
3. **Paste** it into the Query Tool
4. **Click Execute** (▶) or press **F5**

### Verify User Was Created:
```sql
SELECT id, email, name, role, "isApproved"
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

You should see one row with:
- `email`: `enmaeladio@gmail.com`
- `role`: `Super Admin`
- `isApproved`: `true`

---

## Troubleshooting

### ❌ "Connection Refused" or "Could not connect"
- **Problem**: You're using `DATABASE_URL` (internal) instead of `DATABASE_PUBLIC_URL`
- **Solution**: Get `DATABASE_PUBLIC_URL` from Railway Variables tab

### ❌ "SSL Required"
- **Problem**: Railway requires SSL for public connections
- **Solution**: Set SSL mode to `require` in pgAdmin Connection → SSL tab

### ❌ "Authentication Failed"
- **Problem**: Wrong password or username
- **Solution**: Double-check the password from `DATABASE_PUBLIC_URL` (the part between `:` and `@`)

### ❌ "Database does not exist"
- **Problem**: Wrong database name
- **Solution**: Check `DATABASE_PUBLIC_URL` - the database name is after the last `/` (usually `railway`)

### ❌ Can't see `DATABASE_PUBLIC_URL` in Railway
- **Solution**: 
  1. Railway → Postgres → Variables tab
  2. Look for `DATABASE_PUBLIC_URL` or `PUBLIC_DATABASE_URL`
  3. If it doesn't exist, Railway might not have enabled public access
  4. Check Railway → Postgres → Settings for "Public Network" or "External Access" options

---

## Quick Reference: Connection String Format

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Example:
```
postgresql://postgres:abc123@containers-us-west-123.railway.app:5432/railway
```

Becomes in pgAdmin:
- **Host**: `containers-us-west-123.railway.app`
- **Port**: `5432`
- **Database**: `railway`
- **Username**: `postgres`
- **Password**: `abc123`

---

## ✅ After Successfully Connecting

Once connected to Railway's database:
1. ✅ Run the SQL from `docs/RAILWAY_SQL_CREATE_ADMIN.sql`
2. ✅ Verify the user exists with the SELECT query
3. ✅ Try logging in at `https://mannystoolbox.com/auth/signin`
4. ✅ Login should now work!

---

## 🎯 Key Points to Remember

1. **Use `DATABASE_PUBLIC_URL`, NOT `DATABASE_URL`**
2. **Enter connection details separately in pgAdmin** (don't paste the full URL)
3. **Set SSL mode to `require`**
4. **The database name is usually `railway`**
