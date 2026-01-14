# Fix pgAdmin Port Error

## Error Detected

The error shows:
```
connection to server at "66.33.22.254", port 55432 failed
```

## Issues Found

1. **Wrong Port**: You're using `55432`, but it should be `55342`
2. **Connection Closing**: Server is closing the connection, which often means SSL is required

## Correct Settings

From your `DATABASE_PUBLIC_URL`:
```
postgresql://postgres:YBfAoa0ofDjQVWxfYkVaaspwZSFocyay@tramway.proxy.rlwy.net:55342/railway
```

### pgAdmin Connection Settings:

**Connection Tab:**
- **Host name/address**: `tramway.proxy.rlwy.net`
- **Port**: `55342` ⚠️ **NOT 55432!** (Make sure it's exactly `55342`)
- **Maintenance database**: `railway`
- **Username**: `postgres`
- **Password**: `YBfAoa0ofDjQVWxfYkVaaspwZSFocyay`
- **Save password?**: ✅ Check this

**SSL Tab (CRITICAL!):**
- **SSL mode**: `require` ⚠️ **This is required!**

---

## Step-by-Step Fix

1. **Right-click** "MannysToolBox" server → **Properties**
2. **Connection tab**:
   - Verify Host: `tramway.proxy.rlwy.net`
   - **Change Port to**: `55342` (double-check it's not `55432`)
   - Database: `railway`
   - Username: `postgres`
   - Password: `YBfAoa0ofDjQVWxfYkVaaspwZSFocyay`
3. **SSL tab**:
   - **SSL mode**: `require` (This is critical - Railway requires SSL)
4. **Click Save**
5. **Try connecting again**

---

## If Still Not Working

### Option 1: Check Port Again
- Make absolutely sure the port is `55342` (not `55432`, not `5432`)
- Double-check in Railway → Postgres → Variables → `DATABASE_PUBLIC_URL`

### Option 2: Try Different SSL Modes
If `require` doesn't work, try:
- `prefer` (less secure but might work)
- `allow` (least secure, only if others fail)

### Option 3: Use API Endpoint Instead
If pgAdmin continues to have issues, use the API endpoint (much easier):

```powershell
.\scripts\fix-admin-railway.ps1
```

This doesn't require pgAdmin at all and will create the user directly in Railway's database.

---

## Common Mistakes

### ❌ Wrong Port
- Using `55432` (typo)
- Using `5432` (default PostgreSQL port)
- **Correct**: `55342`

### ❌ SSL Not Set
- Leaving SSL mode as default
- **Correct**: Set to `require`

### ❌ Wrong Host
- Using IP address instead of hostname
- **Correct**: `tramway.proxy.rlwy.net`

---

## Verification

After fixing:
1. Port should be exactly `55342`
2. SSL mode should be `require`
3. Host should be `tramway.proxy.rlwy.net`
4. Try connecting - should work now!
