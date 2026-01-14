# Fix pgAdmin Connection to Railway

## Problem
- Password is correct: `YBfAoaOofDjQVWxfYkVaaspwZSFocyay`
- But getting `getaddrinfo failed` error
- This means the **hostname is wrong or incomplete**

## Solution: Get Complete DATABASE_PUBLIC_URL

### Step 1: Get the Full Connection String

1. **Go to Railway → Postgres → Variables tab**
2. **Find `DATABASE_PUBLIC_URL`**
3. **Click the eye icon** 👁️ to reveal the FULL value
4. **Copy the ENTIRE connection string**

It should look like:
```
postgresql://postgres:YBfAoaOofDjQVWxfYkVaaspwZSFocyay@containers-us-west-XXX.railway.app:5432/railway
```

**IMPORTANT:** Make sure you copy the COMPLETE string, not just part of it!

### Step 2: Parse the Connection String

Break down the connection string:

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Example:
```
postgresql://postgres:YBfAoaOofDjQVWxfYkVaaspwZSFocyay@containers-us-west-123.railway.app:5432/railway
```

Extract these values:
- **Username**: `postgres` (before the first `:`)
- **Password**: `YBfAoaOofDjQVWxfYkVaaspwZSFocyay` (between `:` and `@`)
- **Host**: `containers-us-west-123.railway.app` (between `@` and `:`)
- **Port**: `5432` (after the host, before `/`)
- **Database**: `railway` (after the last `/`)

### Step 3: Enter in pgAdmin (Separately!)

**IMPORTANT:** Don't paste the full URL! Enter each component separately.

In pgAdmin Connection tab:

1. **Right-click** on "MannysToolBox" server → **Properties**
2. **Go to "Connection" tab**
3. **Clear the Host field** (remove any full URL)
4. **Enter each value separately:**
   - **Host name/address**: `containers-us-west-123.railway.app` (JUST the hostname, no `postgresql://` or `@`)
   - **Port**: `5432`
   - **Maintenance database**: `railway`
   - **Username**: `postgres`
   - **Password**: `YBfAoaOofDjQVWxfYkVaaspwZSFocyay`
   - **Save password?**: ✅ Check this

5. **Go to "SSL" tab:**
   - **SSL mode**: `require` (Railway requires SSL)

6. **Click "Save"**

### Step 4: Test Connection

1. **Right-click** on "MannysToolBox" server → **Connect**
2. **Enter password** if prompted
3. **Should connect successfully!**

---

## Common Mistakes

### ❌ Wrong: Pasting Full URL in Host Field
```
Host: postgresql://postgres:password@host:5432/database
```

### ✅ Correct: Enter Components Separately
```
Host: containers-us-west-123.railway.app
Port: 5432
Database: railway
Username: postgres
Password: YBfAoaOofDjQVWxfYkVaaspwZSFocyay
```

### ❌ Wrong: Using Internal URL
```
Host: postgres.railway.internal  (won't work from your computer!)
```

### ✅ Correct: Using Public URL
```
Host: containers-us-west-XXX.railway.app  (works from your computer)
```

---

## If Still Not Working

### Check 1: Verify Complete URL
- Make sure you copied the ENTIRE `DATABASE_PUBLIC_URL`
- It should end with `/railway` (or your database name)
- The hostname should be something like `containers-us-west-XXX.railway.app`

### Check 2: SSL Mode
- Set SSL mode to `require` in pgAdmin → Connection → SSL tab
- Railway requires SSL for public connections

### Check 3: Firewall/Network
- Make sure your computer can reach Railway's servers
- Try pinging the hostname: `ping containers-us-west-XXX.railway.app`

### Check 4: Use API Endpoint Instead
If pgAdmin still doesn't work, use the API endpoint (much easier!):

```powershell
.\scripts\fix-admin-railway.ps1
```

Or manually:
```powershell
$body = @{
    email = "enmaeladio@gmail.com"
    password = "En220193"
    name = "Emmanuel Suero"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mannystoolbox.com/api/admin/fix-super-admin" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## Quick Checklist

- [ ] Got COMPLETE `DATABASE_PUBLIC_URL` from Railway
- [ ] Parsed it correctly (host, port, database, username, password)
- [ ] Entered each component SEPARATELY in pgAdmin (not the full URL)
- [ ] Set SSL mode to `require`
- [ ] Saved the connection
- [ ] Tried connecting

---

## Still Having Issues?

The API endpoint method is much simpler and doesn't require pgAdmin at all. Just wait for Railway to finish deploying, then run the PowerShell script!
