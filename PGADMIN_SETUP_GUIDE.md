# pgAdmin4 Setup Guide for Manny's ToolBox

## Step-by-Step Instructions

### Step 1: Open pgAdmin4
1. Launch pgAdmin4 from your Start menu or desktop
2. You may need to enter your master password (the one you set when first installing pgAdmin4)

### Step 2: Connect to Your PostgreSQL Server
1. In the left sidebar, you'll see "Servers"
2. Click the arrow to expand it
3. You should see your PostgreSQL server (usually named something like "PostgreSQL 15" or "PostgreSQL 16")
4. If you see a lock icon, you may need to enter the server password
5. Click on the server to expand it

### Step 3: Get Your Connection Details
1. **Right-click** on your PostgreSQL server name
2. Select **"Properties"** from the context menu
3. Click on the **"Connection"** tab
4. You'll see:
   - **Host name/address**: Usually `localhost` or `127.0.0.1`
   - **Port**: Usually `5432`
   - **Maintenance database**: Usually `postgres`
   - **Username**: Usually `postgres` (or your custom username)
   - **Password**: (You'll need to know this - it's the password you set for PostgreSQL)

### Step 4: Create the Database
1. In the left sidebar, expand your server
2. Expand **"Databases"**
3. **Right-click** on "Databases"
4. Select **"Create"** → **"Database..."**
5. In the "Database" field, enter: `mannys_toolbox`
6. Leave other settings as default
7. Click **"Save"**

### Step 5: Verify Database Creation
1. Expand "Databases" in the left sidebar
2. You should now see `mannys_toolbox` listed
3. Click on it to select it

### Step 6: Format Your Connection String
Use the information from Step 3 to create your DATABASE_URL:

Format:
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
```

Example (replace with your actual values):
```
postgresql://postgres:MyPassword123@localhost:5432/mannys_toolbox?schema=public
```

**Important Notes:**
- Replace `USERNAME` with your username (usually `postgres`)
- Replace `PASSWORD` with your actual PostgreSQL password
- Replace `HOST` with your host (usually `localhost`)
- Replace `PORT` with your port (usually `5432`)
- The database name should be `mannys_toolbox`

### Step 7: Create Your .env File
1. In your project folder, create a new file named `.env` (with the dot at the beginning)
2. Add this content (replace with your actual values):

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mannys_toolbox?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="iuXnHmsxflc5XtVrX0BF799MyZXUka/ub28IHnlocDg="
OPENAI_API_KEY="your-openai-api-key-here"
OPENAI_MODEL="gpt-4-turbo-preview"
NODE_ENV="development"
```

3. Save the file

### Troubleshooting

**Can't find your server password?**
- If you forgot your PostgreSQL password, you may need to reset it
- Or check if you saved it in a password manager

**Can't connect to server?**
- Make sure PostgreSQL service is running
- Check Windows Services (search "services" in Start menu)
- Look for "postgresql" service and make sure it's running

**Port 5432 is in use?**
- Check what port PostgreSQL is actually using in pgAdmin4
- Update the port in your DATABASE_URL accordingly
