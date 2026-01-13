# Complete Login Troubleshooting Guide

## ✅ Password Hash is Correct

I tested the hash - it matches the password `En220193`. So the issue is elsewhere.

---

## 🔍 Step-by-Step Verification

### Step 1: Verify User Exists in Railway Database

Run this SQL in **Railway → Postgres → Data/Query**:

```sql
SELECT 
    id,
    email,
    name,
    role,
    "isApproved",
    LENGTH(password) as pwd_length,
    SUBSTRING(password, 1, 7) as hash_format
FROM users 
WHERE LOWER(email) = 'enmaeladio@gmail.com';
```

**Expected:**
- Should return 1 row
- email: `enmaeladio@gmail.com` (lowercase)
- role: `Super Admin`
- isApproved: `true`
- pwd_length: `60`
- hash_format: `$2a$12$`

### Step 2: Check Railway Logs During Login

1. **Railway → MannysToolBox → Logs tab**
2. **Keep logs open**
3. **Try logging in** in another tab
4. **Watch logs for:**
   - "authorize" messages
   - "findUnique" queries
   - Any error messages

Look for lines like:
```
authorize: checking user enmaeladio@gmail.com
authorize: user found
authorize: password comparison
```

### Step 3: Verify Database Connection

The app might be connecting to a different database. Check:

1. **Railway → MannysToolBox → Variables**
2. **Verify `DATABASE_URL`** points to the same Postgres service
3. **Check if there are multiple Postgres services**

### Step 4: Clear Everything and Try Again

1. **Clear browser cache completely**
2. **Clear cookies** for `mannystoolbox.com`
3. **Try incognito/private mode**
4. **Try a different browser**

---

## 🔧 Common Issues

### Issue 1: User in Wrong Database

If you have multiple databases, the user might be in a different one.

**Fix:** Make sure `DATABASE_URL` in MannysToolBox points to the Postgres service where you ran the SQL.

### Issue 2: Email Case Mismatch

Even though code normalizes to lowercase, check:

```sql
-- Check all variations
SELECT email, role FROM users 
WHERE email ILIKE '%enmaeladio%';
```

### Issue 3: Browser Session Issues

- Clear all cookies
- Try incognito mode
- Try different browser

### Issue 4: NextAuth Session Issues

NextAuth might have cached a failed session. Clear it:

1. Open browser DevTools (F12)
2. Application tab → Cookies
3. Delete all cookies for `mannystoolbox.com`
4. Try again

---

## 🧪 Test Authentication Directly

Create a test API route to verify:

```typescript
// app/api/test-auth/route.ts
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const email = 'enmaeladio@gmail.com'
  const password = 'En220193'
  
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  })
  
  if (!user) {
    return Response.json({ error: 'User not found' })
  }
  
  const match = await bcrypt.compare(password, user.password)
  
  return Response.json({
    userFound: !!user,
    email: user.email,
    role: user.role,
    passwordMatch: match,
    hasPassword: !!user.password
  })
}
```

Then visit: `https://mannystoolbox.com/api/test-auth`

---

## ✅ Complete Fix Checklist

- [ ] User exists in database (run SQL check)
- [ ] Email is lowercase in database
- [ ] Password hash is 60 characters
- [ ] Role is `Super Admin`
- [ ] isApproved is `true`
- [ ] DATABASE_URL points to correct database
- [ ] Cleared browser cache/cookies
- [ ] Tried incognito mode
- [ ] Checked Railway logs during login
- [ ] No errors in Railway logs

---

## 🆘 If Still Not Working

Share:
1. Result of SQL verification query
2. Railway logs when you try to log in (copy the relevant lines)
3. Browser console errors (F12 → Console)
4. Any error messages you see

---

## 💡 Quick Test: Use API Route

I can create a test endpoint to verify authentication works. Would you like me to create that?
