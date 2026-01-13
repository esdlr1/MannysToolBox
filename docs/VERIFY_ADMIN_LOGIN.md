# Verify Admin User and Fix Login

## ✅ Service Status

Your service is now running successfully!
- ✅ Database schema synced
- ✅ Prisma Client generated
- ✅ Next.js server started
- ✅ Ready in 226ms

---

## ⚠️ Login Issue

You're getting "Invalid email or password" error. Let's verify the user exists.

---

## 🔍 Verify User in Database

### Option 1: Check via Railway Database Console

1. **Railway → Postgres → Data/Query tab**
2. **Run this SQL:**

```sql
-- Check if user exists
SELECT id, email, name, role, "isApproved", 
       CASE WHEN password IS NULL THEN 'No password' 
            WHEN LENGTH(password) < 20 THEN 'Invalid hash' 
            ELSE 'Has password' END as password_status
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

**Expected result:**
- Should return 1 row
- Email: `enmaeladio@gmail.com`
- Role: `Super Admin`
- isApproved: `true`
- password_status: `Has password`

### Option 2: Check Password Hash

If user exists but login fails, the password hash might be wrong. Verify:

```sql
-- Check password hash (first 20 chars)
SELECT email, 
       SUBSTRING(password, 1, 20) as hash_preview,
       LENGTH(password) as hash_length
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

**Expected:**
- hash_preview should start with `$2a$12$` or `$2b$12$`
- hash_length should be 60 characters

---

## 🔧 Fix Login Issues

### Issue 1: User Doesn't Exist

If the SQL returns no rows, create the user again:

```sql
-- Use the SQL from docs/RAILWAY_SQL_CREATE_ADMIN.sql
```

### Issue 2: Wrong Password Hash

If password hash looks wrong, regenerate and update:

1. **Generate new hash:**
   ```powershell
   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('En220193', 12).then(h => console.log(h))"
   ```

2. **Update in database:**
   ```sql
   UPDATE users 
   SET password = 'NEW_HASH_HERE'
   WHERE email = 'enmaeladio@gmail.com';
   ```

### Issue 3: Email Case Mismatch

Make sure email is lowercase in database:

```sql
-- Check current email
SELECT email FROM users WHERE LOWER(email) = 'enmaeladio@gmail.com';

-- Fix if needed
UPDATE users 
SET email = LOWER(email)
WHERE LOWER(email) = 'enmaeladio@gmail.com';
```

---

## 🧪 Test Login

After verifying/fixing:

1. **Clear browser cache/cookies** (important!)
2. **Try logging in again:**
   - Email: `enmaeladio@gmail.com`
   - Password: `En220193`
3. **Check Railway logs** if it still fails

---

## 📋 Troubleshooting Checklist

- [ ] User exists in database (run SQL check)
- [ ] Email is lowercase: `enmaeladio@gmail.com`
- [ ] Password hash is correct (60 chars, starts with `$2a$12$`)
- [ ] Role is `Super Admin`
- [ ] isApproved is `true`
- [ ] Cleared browser cache
- [ ] Service is online (✅ it is!)
- [ ] No errors in Railway logs

---

## 🆘 If Still Not Working

Check Railway logs for authentication errors:
- Railway → MannysToolBox → Logs
- Look for "authorize" or "password" errors
- Share the error message

---

## ✅ Expected Behavior

After fixing:
1. ✅ Login succeeds
2. ✅ Redirected to dashboard
3. ✅ Super Admin access granted
4. ✅ Can access all tools
