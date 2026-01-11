# Creating a New PostgreSQL Server in pgAdmin4

## Step-by-Step Guide

### Step 1: Open Register Server Dialog
1. In pgAdmin4, look at the left sidebar
2. Right-click on "Servers" (or "Servers (3)")
3. Select "Register" → "Server..."

### Step 2: Fill in the General Tab
1. The "General" tab should be open by default
2. **Name**: Enter a name for this server (e.g., "MannysToolBox" or "MannysToolBox DB")
3. **Server group**: Leave as "Servers" (default)
4. **Background/Foreground**: Leave as default (unchecked)
5. **Connect now?**: You can check this if you want to connect immediately after saving
6. **Comments**: Optional - you can add a note like "Database for Manny's ToolBox project"

### Step 3: Fill in the Connection Tab
1. Click on the "Connection" tab
2. Fill in the following fields:
   - **Host name/address**: `localhost` (or `127.0.0.1`)
   - **Port**: `5432` (default PostgreSQL port)
   - **Maintenance database**: `postgres` (this is the default database)
   - **Username**: `postgres` (or try your Windows username if that doesn't work)
   - **Password**: Enter your PostgreSQL password
     - If you don't know it, try: `postgres`, `admin`, `password`, or leave blank
   - **Save password?**: Check this box if you want pgAdmin4 to remember the password
   - **Role**: Leave empty (optional)

### Step 4: Test Connection
1. Click "Save" at the bottom
2. If the password is correct, it will connect successfully
3. If you get a password error, try different passwords or see troubleshooting below

### Step 5: Create the Database
Once connected:
1. In the left sidebar, expand your new server (e.g., "MannysToolBox")
2. Expand "Databases"
3. Right-click on "Databases"
4. Select "Create" → "Database..."
5. In the "Database" field, enter: `mannys_toolbox`
6. Click "Save"

### Troubleshooting

**Password Issues:**
- Try common passwords: `postgres`, `admin`, `password`
- Try leaving password blank
- Try your Windows username as the username instead of `postgres`
- Check if you set a password during PostgreSQL installation

**Connection Issues:**
- Make sure PostgreSQL service is running (check Windows Services)
- Verify the port is 5432
- Try `127.0.0.1` instead of `localhost`

**If You Can't Remember Password:**
- You may need to reset PostgreSQL password (see POSTGRES_PASSWORD_RESET.md)
- Or use an existing working server connection
