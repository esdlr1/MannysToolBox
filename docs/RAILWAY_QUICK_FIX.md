# Quick Fix: Create Super Admin in Railway Database

## Problem Confirmed
The debug endpoint shows `user: null` - the user doesn't exist in Railway database.

## Solution: Run SQL in Railway

### Step 1: Open Railway Database Console
1. Go to **Railway Dashboard** → Your Project
2. Click on **Postgres** service
3. Click **Data** tab
4. Click **Query** tab

### Step 2: Copy and Run This SQL

```sql
-- Create or update Super Admin user
INSERT INTO users (id, email, name, password, role, "isApproved", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'enmaeladio@gmail.com',
    'Emmanuel Suero',
    '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',
    'Super Admin',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
    email = 'enmaeladio@gmail.com',
    role = 'Super Admin',
    password = '$2a$12$bEC4obigA8U5XcXm9lnZj.DU0u.a.9MCyK6dKjGgQJsvTxZyatbia',
    "isApproved" = true,
    name = 'Emmanuel Suero',
    "updatedAt" = NOW();

-- Create profile if it doesn't exist
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

-- Verify user was created
SELECT id, email, name, role, "isApproved", "createdAt"
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

### Step 3: Verify
After running the SQL, you should see a row returned with:
- `email`: `enmaeladio@gmail.com`
- `role`: `Super Admin`
- `isApproved`: `true`

### Step 4: Test Login
1. Go to `https://mannystoolbox.com/auth/signin`
2. Enter:
   - Email: `enmaeladio@gmail.com`
   - Password: `En220193`
3. Click "Sign In"

### Step 5: Verify with Debug Endpoint
Run this in browser console to confirm:
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

You should now see:
- `user: { ... }` (not null)
- `password: {matches: true}`
- `authentication: {wouldSucceed: true}`
