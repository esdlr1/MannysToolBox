# Fix Super Admin Login on Railway

## Problem
You can log in locally but not on Railway. This means:
- ✅ Local database has correct user
- ❌ Railway database has incorrect/missing user

## Quick Fix: Use API Endpoint

### Option 1: PowerShell Script (Easiest)

Run this from your project directory:

```powershell
.\scripts\fix-admin-railway.ps1
```

### Option 2: Manual API Call

**Using PowerShell:**
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

**Using Browser Console:**
```javascript
fetch('https://mannystoolbox.com/api/admin/fix-super-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'enmaeladio@gmail.com',
    password: 'En220193',
    name: 'Emmanuel Suero'
  })
})
.then(r => r.json())
.then(console.log)
```

**Using curl:**
```bash
curl -X POST https://mannystoolbox.com/api/admin/fix-super-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"enmaeladio@gmail.com","password":"En220193","name":"Emmanuel Suero"}'
```

## Alternative: Use SQL Directly

If the API endpoint doesn't work, use SQL in Railway:

1. Go to **Railway → Your Project → Postgres → Data/Query tab**
2. Run the SQL from `docs/RAILWAY_SQL_CREATE_ADMIN.sql`

Or run this complete fix:

```sql
-- Fix Super Admin user in Railway database
INSERT INTO users (id, email, name, password, role, "isApproved", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'enmaeladio@gmail.com',  -- Lowercase email (required)
    'Emmanuel Suero',
    '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',  -- Hash for En220193
    'Super Admin',  -- Exact role with space (required)
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
    email = 'enmaeladio@gmail.com',  -- Ensure lowercase
    role = 'Super Admin',  -- Exact role with space
    password = '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',
    "isApproved" = true,
    name = 'Emmanuel Suero',
    "updatedAt" = NOW();

-- Ensure profile exists
INSERT INTO profiles (id, "userId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    u.id,
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'enmaeladio@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p."userId" = u.id
);

-- Verify
SELECT 
    id,
    email,
    name,
    role,
    "isApproved",
    LENGTH(password) as password_length,
    SUBSTRING(password, 1, 7) as hash_format
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

## Verify It Worked

After running the fix:

1. **Check the response** - Should show `loginShouldWork: true`
2. **Try logging in** at `https://mannystoolbox.com/auth/signin`
3. **Use debug endpoint** to verify:
   ```javascript
   fetch('https://mannystoolbox.com/api/auth/debug-login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: 'enmaeladio@gmail.com',
       password: 'En220193'
     })
   })
   .then(r => r.json())
   .then(console.log)
   ```

## Why This Happens

- Local and Railway databases are **separate**
- User created locally doesn't exist on Railway
- Need to create/update user in Railway database specifically

## Prevention

After fixing, the user will persist in Railway. If you need to recreate:
- Use the fix endpoint: `/api/admin/fix-super-admin`
- Or run the SQL script in Railway database console
