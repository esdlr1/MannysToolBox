# Connect pgAdmin 4 to Railway Database

## Problem
Railway doesn't have a Query tab, so you need to connect pgAdmin 4 to Railway's database to run SQL.

## Step 1: Get Railway Database Connection Details

### Option A: From Railway Dashboard
1. Go to **Railway Dashboard** → Your Project
2. Click on **Postgres** service
3. Click **Variables** tab
4. Look for `DATABASE_URL` or `POSTGRES_URL`
5. Copy the connection string (it looks like: `postgresql://postgres:PASSWORD@HOST:PORT/railway`)

### Option B: From Railway Service Settings
1. Go to **Railway Dashboard** → Your Project → Postgres
2. Click **Settings** tab
3. Look for connection details or use the **Connect** button
4. Railway may show connection parameters separately

## Step 2: Parse the Connection String

Your Railway `DATABASE_URL` will look like:
```
postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:PORT/railway
```

Extract these values:
- **Host**: `containers-us-west-XXX.railway.app` (or similar)
- **Port**: Usually `5432` (check your connection string)
- **Database**: `railway` (or the database name in the URL)
- **Username**: `postgres` (usually)
- **Password**: The password from the connection string

## Step 3: Add Railway Server in pgAdmin 4

1. **Open pgAdmin 4**
2. **Right-click** on "Servers" in the left panel
3. **Select** "Create" → "Server..."
4. **Fill in the "General" tab:**
   - **Name**: `Railway - MannysToolBox` (or any name you prefer)

5. **Go to "Connection" tab:**
   - **Host name/address**: Paste the host from Step 2 (e.g., `containers-us-west-XXX.railway.app`)
   - **Port**: `5432` (or the port from your connection string)
   - **Maintenance database**: `railway` (or the database name from your connection string)
   - **Username**: `postgres` (usually)
   - **Password**: Paste the password from your connection string
   - **Save password**: ✅ Check this box

6. **Go to "SSL" tab (if needed):**
   - **SSL mode**: Try `prefer` or `require` if connection fails

7. **Click "Save"**

## Step 4: Connect and Verify

1. **Expand** the new server in the left panel
2. **Expand** "Databases"
3. **Find** the `railway` database (or your database name)
4. **Right-click** on the database → **Query Tool**
5. **Run a test query:**
   ```sql
   SELECT current_database(), current_user;
   ```
   You should see Railway's database name and user.

## Step 5: Run the Admin Creation SQL

Once connected to Railway's database:

1. **Right-click** on the `railway` database → **Query Tool**
2. **Copy** the SQL from `docs/RAILWAY_SQL_CREATE_ADMIN.sql`
3. **Paste** it into the Query Tool
4. **Click** the Execute button (▶) or press F5
5. **Verify** the user was created:
   ```sql
   SELECT id, email, name, role, "isApproved"
   FROM users 
   WHERE email = 'enmaeladio@gmail.com';
   ```

## Troubleshooting

### Connection Refused
- Check if Railway's database allows external connections
- Verify the host and port are correct
- Railway might require SSL - set SSL mode to `require`

### Authentication Failed
- Double-check the password from Railway's connection string
- Make sure you're using the correct username
- Railway might have rotated the password - get a fresh connection string

### Can't Find Database
- The database name in Railway is usually `railway`
- Check your `DATABASE_URL` to confirm the database name
- It's the part after the last `/` in the connection string

### Alternative: Use Railway's Public Database URL

If Railway provides a "Public Database URL" (different from internal URL):
1. Use that URL instead
2. It's designed for external connections
3. Parse it the same way to get connection details

## Quick Reference: Connection String Format

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Example:
```
postgresql://postgres:abc123@containers-us-west-123.railway.app:5432/railway
```

Becomes:
- Host: `containers-us-west-123.railway.app`
- Port: `5432`
- Database: `railway`
- Username: `postgres`
- Password: `abc123`
