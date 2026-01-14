# How to Get Railway Database Password

## Method 1: From Railway Variables Tab

1. **Go to Railway Dashboard** → Your Project
2. **Click on Postgres service**
3. **Click "Variables" tab**
4. **Find `DATABASE_PUBLIC_URL`** (or `DATABASE_URL`)
5. **Click the eye icon** 👁️ to reveal the value
6. **Copy the entire connection string**

The password is the part between `:` and `@` in the URL.

### Example:
```
postgresql://postgres:YBfAoaOofDjQVWxfYkVaaspwZSFocyay@containers-us-west-123.railway.app:5432/railway
```

The password is: `YBfAoaOofDjQVWxfYkVaaspwZSFocyay` (the part between `postgres:` and `@`)

---

## Method 2: Parse the Connection String

Your connection string format:
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

To extract the password:
1. Find the part after `postgres:` (or your username)
2. Find the part before `@`
3. That's your password!

---

## Method 3: Use Individual Variables

Railway also provides separate variables:
- `PGPASSWORD` - Contains just the password
- `PGUSER` - Contains the username
- `PGHOST` - Contains the host
- `PGPORT` - Contains the port
- `PGDATABASE` - Contains the database name

Check Railway → Postgres → Variables tab for these.

---

## ⚠️ Important Notes

1. **Use `DATABASE_PUBLIC_URL`** for external connections (from your computer)
2. **Don't use `DATABASE_URL`** - it has `postgres.railway.internal` which only works inside Railway
3. **The password is case-sensitive** - copy it exactly as shown
4. **Click the eye icon** to reveal masked passwords

---

## If You Still Can't Find It

If Railway doesn't show `DATABASE_PUBLIC_URL`:
1. Check Railway → Postgres → Settings
2. Look for "Public Network" or "External Access" options
3. Railway might need to enable public access first
4. Or use the API endpoint method (see below)
