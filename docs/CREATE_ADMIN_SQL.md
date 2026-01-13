# Create Super Admin via Railway SQL Console (Alternative Method)

## ✅ If API Route Not Available

If the API route isn't deployed yet, you can create the admin directly via SQL in Railway's database console.

---

## 🔧 Steps

### Step 1: Open Railway Database Console

1. **Go to Railway Dashboard**
2. **Click on your Postgres service** (elephant icon)
3. **Click "Data" or "Query" tab**
4. **Open the SQL editor**

### Step 2: Generate Password Hash

First, we need to generate a bcrypt hash for the password `En220193`.

**Option A: Use Online Tool**
- Go to: https://bcrypt-generator.com/
- Enter password: `En220193`
- Rounds: `12`
- Copy the hash

**Option B: Use Node.js (Local)**
```powershell
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('En220193', 12).then(hash => console.log(hash))"
```

### Step 3: Run SQL Query

Once you have the bcrypt hash, run this SQL in Railway's database console:

```sql
-- Check if user already exists
SELECT id, email, name, role, "isApproved" 
FROM users 
WHERE email = 'enmaeladio@gmail.com';

-- If user doesn't exist, create it
-- Replace 'YOUR_BCRYPT_HASH_HERE' with the hash from Step 2
INSERT INTO users (id, email, name, password, role, "isApproved", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'enmaeladio@gmail.com',
    'Emmanuel Suero',
    'YOUR_BCRYPT_HASH_HERE',  -- Replace with actual hash
    'Super Admin',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
    role = 'Super Admin',
    password = 'YOUR_BCRYPT_HASH_HERE',  -- Replace with actual hash
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
SELECT id, email, name, role, "isApproved" 
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

---

## 🔐 Generate Bcrypt Hash (PowerShell)

If you have Node.js installed locally:

```powershell
# Install bcryptjs if needed
npm install bcryptjs

# Generate hash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('En220193', 12).then(hash => console.log('Hash:', hash))"
```

Copy the hash and replace `YOUR_BCRYPT_HASH_HERE` in the SQL above.

---

## ✅ After Running SQL

1. ✅ User should be created
2. ✅ Try logging in at https://mannystoolbox.com
3. ✅ Email: `enmaeladio@gmail.com`
4. ✅ Password: `En220193`

---

## 🆘 Troubleshooting

### "relation users does not exist"
- Database schema might not be pushed
- Run `npm run db:push` in Railway (or it should auto-deploy)

### "duplicate key value violates unique constraint"
- User already exists
- The `ON CONFLICT` clause will update it instead

### "password authentication failed" after creating
- Check the bcrypt hash is correct
- Make sure password matches: `En220193`

---

## 📝 Quick Hash Generation

**Simplest method:**
1. Go to https://bcrypt-generator.com/
2. Enter: `En220193`
3. Rounds: `12`
4. Click "Generate"
5. Copy the hash
6. Use in SQL query above
