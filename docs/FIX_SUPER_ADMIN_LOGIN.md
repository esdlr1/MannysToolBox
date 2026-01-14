# Fix Super Admin Login Issue

## Problem
Cannot log in as Super Admin even though user was created in the database.

## Root Cause Analysis

The password hash in the SQL script is **correct** (verified). The issue is likely one of these:

1. **Email case mismatch** - Email in database might not be lowercase
2. **User doesn't exist** - User wasn't actually created
3. **Wrong database** - Connecting to local instead of Railway (or vice versa)
4. **Role value mismatch** - Role stored differently than expected

## Diagnostic Steps

### Step 1: Use Debug Endpoint (After Deployment)

Once the debug endpoint is deployed, test it:

```bash
# On Railway (replace with your domain)
curl -X POST https://mannystoolbox.com/api/auth/debug-login \
  -H "Content-Type: application/json" \
  -d '{"email":"enmaeladio@gmail.com","password":"En220193"}'
```

Or use a tool like Postman or browser console:

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

### Step 2: Verify User in Railway Database

Go to Railway → Postgres → Data/Query tab and run:

```sql
-- Check if user exists
SELECT id, email, name, role, "isApproved", 
       LENGTH(password) as password_length,
       SUBSTRING(password, 1, 7) as hash_prefix
FROM users 
WHERE email = 'enmaeladio@gmail.com';

-- Check for case variations
SELECT id, email, name, role, "isApproved"
FROM users 
WHERE LOWER(email) = 'enmaeladio@gmail.com';
```

### Step 3: Fix Common Issues

#### Issue A: Email Case Mismatch

If the email in the database has different casing, update it:

```sql
UPDATE users 
SET email = 'enmaeladio@gmail.com'
WHERE LOWER(email) = 'enmaeladio@gmail.com';
```

#### Issue B: User Doesn't Exist

Run the full SQL script again (see `docs/RAILWAY_SQL_CREATE_ADMIN.sql`)

#### Issue C: Password Hash Issue

If password doesn't match, generate a new hash and update:

```sql
-- Generate new hash using Node.js:
-- node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('En220193', 12).then(h => console.log(h));"

-- Then update:
UPDATE users 
SET password = 'NEW_HASH_HERE'
WHERE email = 'enmaeladio@gmail.com';
```

#### Issue D: Role Value Issue

Verify and fix role:

```sql
-- Check current role
SELECT role FROM users WHERE email = 'enmaeladio@gmail.com';

-- Update if needed (should be exactly 'Super Admin' with space)
UPDATE users 
SET role = 'Super Admin', "isApproved" = true
WHERE email = 'enmaeladio@gmail.com';
```

## Complete Fix SQL Script

Run this in Railway → Postgres → Data/Query tab:

```sql
-- Step 1: Check current state
SELECT id, email, name, role, "isApproved", 
       LENGTH(password) as pwd_len,
       SUBSTRING(password, 1, 20) as hash_preview
FROM users 
WHERE LOWER(email) = 'enmaeladio@gmail.com';

-- Step 2: Delete existing user (if needed)
-- DELETE FROM profiles WHERE "userId" IN (SELECT id FROM users WHERE LOWER(email) = 'enmaeladio@gmail.com');
-- DELETE FROM users WHERE LOWER(email) = 'enmaeladio@gmail.com';

-- Step 3: Create/Update user with correct values
INSERT INTO users (id, email, name, password, role, "isApproved", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'enmaeladio@gmail.com',  -- Lowercase email
    'Emmanuel Suero',
    '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',  -- Hash for En220193
    'Super Admin',  -- Exact role with space
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
    email = 'enmaeladio@gmail.com',  -- Ensure lowercase
    role = 'Super Admin',  -- Exact role
    password = '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',
    "isApproved" = true,
    name = 'Emmanuel Suero',
    "updatedAt" = NOW();

-- Step 4: Create profile if missing
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

-- Step 5: Verify final state
SELECT 
    id,
    email,
    name,
    role,
    "isApproved",
    LENGTH(password) as password_length,
    SUBSTRING(password, 1, 7) as hash_format,
    "createdAt"
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

## Expected Results

After running the fix script, you should see:
- `email`: `enmaeladio@gmail.com` (lowercase)
- `role`: `Super Admin` (with space)
- `isApproved`: `true`
- `password_length`: `60`
- `hash_format`: `$2a$12$`

## Test Login

1. Go to `https://mannystoolbox.com/auth/signin` (or localhost)
2. Enter:
   - Email: `enmaeladio@gmail.com`
   - Password: `En220193`
3. Click "Sign In"

## Still Not Working?

1. **Check browser console** for errors
2. **Clear browser cache and cookies**
3. **Try incognito/private window**
4. **Check Railway logs** for authentication errors
5. **Use debug endpoint** to see exact issue
6. **Verify DATABASE_URL** in Railway environment variables points to correct database
