# Fix: Local Database Connection

## ⚠️ Issue

Your local `.env` file is pointing to Railway's database (`postgres.railway.internal`) instead of your local PostgreSQL database.

This means:
- Local dev server can't connect to database
- Can't create/login as super admin locally
- Need to use local database for local development

---

## ✅ Solution: Update Local .env

### Step 1: Check Your Local PostgreSQL Connection

You need your local PostgreSQL connection details:
- **Host:** `localhost` or `127.0.0.1`
- **Port:** Usually `5432`
- **Username:** Usually `postgres`
- **Password:** Your local PostgreSQL password
- **Database:** `mannys_toolbox`

### Step 2: Update .env File

Open your `.env` file and update `DATABASE_URL`:

**Current (Railway):**
```env
DATABASE_URL="postgresql://postgres:...@postgres.railway.internal:5432/railway"
```

**Should be (Local):**
```env
DATABASE_URL="postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/mannys_toolbox?schema=public"
```

**Example:**
```env
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/mannys_toolbox?schema=public"
```

### Step 3: Push Schema to Local Database

After updating `.env`:

```powershell
npm run db:push
```

This will create all tables in your local database.

### Step 4: Create Super Admin Locally

```powershell
npm run create:admin
```

Enter:
- Email: `enmaeladio@gmail.com`
- Name: `Emmanuel Suero`
- Password: `En220193`

### Step 5: Test Login

1. Make sure dev server is running: `npm run dev`
2. Go to: `http://localhost:3000/auth/signin`
3. Log in with: `enmaeladio@gmail.com` / `En220193`

---

## 🔄 Two Separate Databases

**Important:** You now have two separate databases:

1. **Local Database** (for development)
   - Used when running `npm run dev`
   - Stored in your local PostgreSQL
   - Database: `mannys_toolbox`

2. **Railway Database** (for production)
   - Used by Railway deployment
   - Stored in Railway's PostgreSQL
   - Database: `railway`

**You need to:**
- Create admin user in BOTH databases
- Keep local `.env` pointing to local database
- Railway uses its own `DATABASE_URL` from Railway variables

---

## 📝 Quick Setup for Local

1. **Update `.env`:**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mannys_toolbox?schema=public"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-local-secret"
   ```

2. **Push schema:**
   ```powershell
   npm run db:push
   ```

3. **Create admin:**
   ```powershell
   npm run create:admin
   ```

4. **Test login:**
   - Go to `http://localhost:3000/auth/signin`
   - Use: `enmaeladio@gmail.com` / `En220193`

---

## 🆘 Troubleshooting

### "Can't reach database server"
- Make sure PostgreSQL is running locally
- Check connection string is correct
- Verify database `mannys_toolbox` exists

### "Database does not exist"
- Create it in pgAdmin: `mannys_toolbox`
- Or change database name in `DATABASE_URL`

### "Password authentication failed"
- Check your local PostgreSQL password
- Try connecting in pgAdmin first to verify

---

## ✅ After Fixing

Once local `.env` is correct:
- ✅ Local dev server can connect to local database
- ✅ Can create admin user locally
- ✅ Can log in on localhost
- ✅ Railway still uses its own database (separate)
