# Troubleshooting Super Admin Login Issues

## ✅ Your Super Admin User Status

- **Email**: `Enmaeladio@gmail.com`
- **Role**: Super Admin
- **Approved**: Yes
- **Has Password**: Yes

---

## 🔍 Common Login Issues

### 1. **Email Case Sensitivity**
The system normalizes emails to lowercase, so `Enmaeladio@gmail.com` should work as:
- `enmaeladio@gmail.com`
- `Enmaeladio@gmail.com`
- `ENMAELADIO@GMAIL.COM`

**Solution**: Try using all lowercase: `enmaeladio@gmail.com`

### 2. **Password Mismatch**
If you're getting "Invalid email or password", the password might be:
- Incorrect
- Changed but not saved properly
- Has extra spaces

**Solution**: 
- Reset your password using the script:
  ```bash
  npm run create:admin
  ```
- When prompted, enter your email: `enmaeladio@gmail.com`
- Choose 'y' to update
- Enter a new password

### 3. **Browser Cache/Session**
Sometimes old sessions can interfere with login.

**Solution**: 
- Clear browser cookies/cache
- Try incognito/private mode
- Try a different browser

### 4. **Database Connection**
If the database isn't connected, login will fail silently.

**Solution**: 
- Check your `.env` file has correct `DATABASE_URL`
- Verify database is running
- Test connection with: `npm run db:studio`

---

## 🛠️ Quick Fixes

### Option 1: Reset Password
```bash
npm run create:admin
```
When prompted:
1. Email: `enmaeladio@gmail.com`
2. Choose 'y' to update existing user
3. Enter new password

### Option 2: Verify User in Database
```bash
npm run check:admin
```

### Option 3: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try logging in
4. Look for any error messages

---

## 🧪 Test Authentication

To test if your password works, run:
```bash
npm run check:admin enmaeladio@gmail.com YOUR_PASSWORD
```

This will verify:
- User exists
- Password is correct
- Role is Super Admin
- Approval status

---

## 📝 Manual Database Check (Optional)

If you have pgAdmin4 or database access:

```sql
-- Check your user
SELECT id, email, name, role, "isApproved" 
FROM users 
WHERE email = 'enmaeladio@gmail.com';

-- Check if password hash exists (should be long string)
SELECT id, email, 
       CASE WHEN password IS NULL THEN 'No password' 
            WHEN LENGTH(password) < 20 THEN 'Invalid hash' 
            ELSE 'Has valid password hash' END as password_status
FROM users 
WHERE email = 'enmaeladio@gmail.com';
```

---

## ✅ Quick Checklist

Before trying to log in, verify:
- [ ] Email is correct: `enmaeladio@gmail.com` (try lowercase)
- [ ] Password is correct (no extra spaces)
- [ ] Database connection is working (`npm run db:studio`)
- [ ] No browser cache issues (try incognito)
- [ ] Server is running (`npm run dev`)

---

## 🚨 Still Having Issues?

If none of the above works:

1. **Reset your password**:
   ```bash
   npm run create:admin
   ```

2. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Check server logs** when trying to log in - look for errors in the terminal

4. **Verify environment variables**:
   - `NEXTAUTH_SECRET` is set
   - `NEXTAUTH_URL` matches your local URL (usually `http://localhost:3000`)

---

## 📞 Need More Help?

Share the following information:
1. Error message you see (if any)
2. Browser console errors (F12 → Console)
3. Server terminal output when trying to log in
4. Result of `npm run check:admin`
