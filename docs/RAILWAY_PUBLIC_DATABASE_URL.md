# Getting Railway Public Database URL

## ⚠️ Issue

Railway's `DATABASE_URL` uses `postgres.railway.internal` which is **only accessible from within Railway's network**, not from your local machine.

---

## ✅ Solution: Get Public Database URL

### Option 1: Railway Public URL (Recommended)

1. **Go to Railway Dashboard**
2. **Click on your Postgres service**
3. **Go to "Variables" tab**
4. **Look for `PUBLIC_DATABASE_URL`** or **"Connect" tab**

   OR

5. **Go to Postgres service → "Connect" or "Data" tab**
6. **Look for "Public Network" or "Connection String"**
7. **Copy the public URL** (it will have a public hostname, not `railway.internal`)

### Option 2: Use Railway's Database Console

Instead of connecting from local, use Railway's built-in database console:

1. **Go to Railway → Postgres service**
2. **Click "Data" or "Query" tab**
3. **Use the SQL editor** to create the user directly

---

## 🔧 Alternative: Use API Route (Easiest)

Since connecting from local is difficult, use the API route I created:

### Step 1: Add Secret to Railway

1. **Railway → MannysToolBox → Variables**
2. **Add variable:**
   - Name: `ADMIN_CREATE_SECRET`
   - Value: `create-admin-2024` (or any secret you want)

### Step 2: Call the API

**Using PowerShell:**
```powershell
$body = @{
    email = "enmaeladio@gmail.com"
    name = "Emmanuel Suero"
    password = "En220193"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://mannystoolbox.com/api/admin/create" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer create-admin-2024"
        "Content-Type" = "application/json"
    } `
    -Body $body
```

**Or using curl (if you have it):**
```bash
curl -X POST https://mannystoolbox.com/api/admin/create \
  -H "Authorization: Bearer create-admin-2024" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"enmaeladio@gmail.com\",\"name\":\"Emmanuel Suero\",\"password\":\"En220193\"}"
```

### Step 3: Delete the Route (Security)

After creating the admin, delete `app/api/admin/create/route.ts` for security.

---

## 🗄️ Option 3: Use Railway Database Console (SQL)

1. **Railway → Postgres → Data/Query tab**
2. **Open SQL editor**
3. **Run this SQL** (you'll need to hash the password first):

```sql
-- First, install pgcrypto extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the user (password hash for "En220193")
-- Note: This uses bcrypt, you'll need to generate the hash
-- Or use the API route method above which handles hashing

-- Check if user exists
SELECT id, email, name, role, "isApproved" 
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

**Note:** Generating bcrypt hashes in SQL is complex. The API route method is easier.

---

## ✅ Recommended: Use API Route

The API route method is the easiest:
1. ✅ No need to get public database URL
2. ✅ Handles password hashing automatically
3. ✅ Works from anywhere
4. ✅ Just call the API endpoint

---

## 📝 Quick Steps (API Route Method)

1. **Add to Railway Variables:**
   ```
   ADMIN_CREATE_SECRET = create-admin-2024
   ```

2. **Run PowerShell command** (see above)

3. **Verify login works**

4. **Delete the API route** for security

---

## 🆘 If API Route Doesn't Work

If you can't use the API route, you'll need Railway's public database URL. Check:
- Railway → Postgres → Connect tab
- Railway → Postgres → Settings → Connection
- Look for "Public Network" or "External Connection"

The public URL will have a different hostname (not `railway.internal`).
