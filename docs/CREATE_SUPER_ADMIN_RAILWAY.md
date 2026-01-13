# Create Super Admin in Railway (Production Database)

## ⚠️ Issue

You created the super admin in your **local database**, but Railway uses a **separate production database**. They are different!

---

## ✅ Solution: Create Super Admin in Railway Database

### Option 1: Use Railway's Database Console (Recommended)

1. **Go to Railway Dashboard**
2. **Click on your Postgres service** (the elephant icon)
3. **Click on the "Data" or "Query" tab**
4. **Open the database console/query editor**

5. **Run this SQL query** (replace with your values):

```sql
-- First, check if user exists
SELECT id, email, name, role, "isApproved" 
FROM users 
WHERE email = 'enmaeladio@gmail.com';

-- If user doesn't exist, create it
-- Note: You'll need to hash the password first (see Option 2)
```

### Option 2: Use Prisma Studio with Railway Database (Easier)

1. **Get Railway Database URL:**
   - Go to Railway → Postgres service → Variables
   - Copy the `DATABASE_URL` value

2. **Update your local .env temporarily:**
   ```env
   DATABASE_URL="postgresql://postgres:YBfAoa0ofDjQVWxfYkVaaspwZSFocyay@postgres.railway.internal:5432/railway"
   ```
   (Use the actual Railway DATABASE_URL from your Railway variables)

3. **Run the create admin script:**
   ```bash
   npm run create:admin
   ```
   - Email: `enmaeladio@gmail.com`
   - Name: `Emmanuel Suero`
   - Password: `En220193`

4. **Change .env back to local** (if needed)

### Option 3: Create via API Route (Best for Production)

Create a one-time admin creation endpoint:

1. **Create file:** `app/api/admin/create/route.ts`
2. **Add the code** (see below)
3. **Call it once** with a secret key
4. **Delete the route** after use

---

## 🔧 Quick Fix: Update Local .env to Railway DB

**Temporary setup to create admin in Railway:**

1. **Backup your local .env:**
   ```bash
   cp .env .env.local.backup
   ```

2. **Update .env with Railway DATABASE_URL:**
   - Get `DATABASE_URL` from Railway → Postgres → Variables
   - Update your local `.env` file:
   ```env
   DATABASE_URL="postgresql://postgres:YBfAoa0ofDjQVWxfYkVaaspwZSFocyay@postgres.railway.internal:5432/railway"
   ```

3. **Run create admin script:**
   ```bash
   npm run create:admin
   ```
   - Email: `enmaeladio@gmail.com`
   - Name: `Emmanuel Suero`  
   - Password: `En220193`

4. **Restore local .env:**
   ```bash
   cp .env.local.backup .env
   ```

---

## 📝 Your Super Admin Credentials

- **Email:** `enmaeladio@gmail.com`
- **Password:** `En220193`
- **Role:** Super Admin

**Important:** Make sure this user exists in **Railway's database**, not just local!

---

## 🧪 Verify User Exists in Railway DB

After creating, verify:

1. **Option A: Use Prisma Studio:**
   ```bash
   # With Railway DATABASE_URL in .env
   npm run db:studio
   ```
   - Open http://localhost:5555
   - Check Users table
   - Verify user exists

2. **Option B: Check via Railway Logs:**
   - Try logging in
   - Check Railway logs for authentication errors

---

## 🆘 Troubleshooting

### "Invalid email or password"
- User doesn't exist in Railway database
- Create user in Railway DB (see above)

### "User exists but can't log in"
- Check email is lowercase: `enmaeladio@gmail.com`
- Verify password is correct
- Check `isApproved` is `true` in database

### "Connection refused"
- Railway DATABASE_URL might be internal
- Use Railway's public connection string if available
- Or use Railway's database console instead

---

## ✅ After Creating in Railway

1. ✅ User created in Railway database
2. ✅ Try logging in at https://mannystoolbox.com
3. ✅ Use: `enmaeladio@gmail.com` / `En220193`
4. ✅ Should work now!

---

## 🔒 Security Note

After creating the admin user in production:
- Consider changing the password
- Don't share credentials
- Use strong passwords in production
