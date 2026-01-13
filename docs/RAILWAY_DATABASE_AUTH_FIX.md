# Fix: Railway Database Authentication Error

## ⚠️ Error

```
Error: P1000: Authentication failed against database server at `postgres.railway.internal`
The provided database credentials for `postgres` are not valid.
```

This means the `DATABASE_URL` in Railway variables has incorrect credentials.

---

## ✅ Solution: Regenerate DATABASE_URL

### Step 1: Get Fresh Database URL from Railway

1. **Go to Railway Dashboard**
2. **Click on your Postgres service** (elephant icon)
3. **Go to "Variables" tab**
4. **Find `DATABASE_URL`**
5. **Copy the entire value**

   OR

6. **Go to Postgres → "Connect" or "Data" tab**
7. **Look for "Connection String" or "Postgres Connection URL"**
8. **Copy the connection string**

### Step 2: Update DATABASE_URL in MannysToolBox Service

1. **Go to Railway → MannysToolBox service**
2. **Click "Variables" tab**
3. **Find `DATABASE_URL` variable**
4. **Click the three dots (⋮) → Edit**
5. **Paste the fresh DATABASE_URL from Postgres service**
6. **Save**

### Step 3: Verify Connection

After updating, Railway will restart the service. Check logs to see if authentication succeeds.

---

## 🔧 Alternative: Remove db push from Start Command

If `prisma db push` keeps failing, we can remove it from the start command and push schema manually:

**Update `railway.json`:**
```json
{
  "deploy": {
    "startCommand": "next start"
  }
}
```

Then push schema manually using Railway CLI or database console.

---

## 📋 Quick Fix Steps

1. **Railway → Postgres → Variables**
2. **Copy `DATABASE_URL`**
3. **Railway → MannysToolBox → Variables**
4. **Update `DATABASE_URL` with fresh value**
5. **Service will restart automatically**
6. **Check logs for success**

---

## 🆘 If Still Failing

### Option 1: Check Postgres Service Status
- Railway → Postgres
- Make sure it's "Online"
- Check if it needs to be restarted

### Option 2: Regenerate Postgres Password
- Railway → Postgres → Settings
- Look for "Reset Password" or "Regenerate"
- This will create a new DATABASE_URL

### Option 3: Remove db push Temporarily
- Update `railway.json` to remove `prisma db push` from start command
- Push schema manually via Railway database console
- Then add it back once connection works

---

## ✅ After Fix

Once DATABASE_URL is correct:
- Service will start successfully
- Schema will be pushed automatically
- App will be accessible

---

## 📝 Note

Railway's `DATABASE_URL` should look like:
```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

Make sure the password in the URL matches the Postgres service password.
