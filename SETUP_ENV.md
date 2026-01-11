# Environment Variables Setup Guide

## Step 1: Create .env File

Create a file named `.env` in the root directory of your project (same folder as `package.json`).

## Step 2: Get PostgreSQL Connection String

### Using pgAdmin4:

1. **Open pgAdmin4** and connect to your PostgreSQL server
2. **Create a new database** (if you haven't already):
   - Right-click on "Databases" → Create → Database
   - Name it: `mannys_toolbox`
   - Click Save

3. **Get your connection details**:
   - Right-click on your server → Properties
   - Note down:
     - **Host**: Usually `localhost` or `127.0.0.1`
     - **Port**: Usually `5432`
     - **Username**: Usually `postgres` (or your custom username)
     - **Password**: Your PostgreSQL password

4. **Format your DATABASE_URL**:
   ```
   postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
   ```
   
   Example:
   ```
   postgresql://postgres:mypassword@localhost:5432/mannys_toolbox?schema=public
   ```

### Alternative: Find connection string in pgAdmin4

1. Right-click on your database → Properties → Connection
2. You'll see the connection parameters there
3. Format them as shown above

## Step 3: Generate NEXTAUTH_SECRET

Run this command in PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and use it as your `NEXTAUTH_SECRET`.

## Step 4: Complete .env File

Copy this template into your `.env` file and replace the values:

```env
# Database
# Replace with your actual PostgreSQL connection string
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mannys_toolbox?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
# Use the secret generated in Step 3
NEXTAUTH_SECRET="iuXnHmsxflc5XtVrX0BF799MyZXUka/ub28IHnlocDg="

# OpenAI (Optional - can add later)
OPENAI_API_KEY="your-openai-api-key-here"
OPENAI_MODEL="gpt-4-turbo-preview"

# Node Environment
NODE_ENV="development"
```

## Step 5: Verify Setup

After creating the `.env` file, run:
```powershell
npm run db:push
```

This should successfully connect to your database and create the tables.

## Troubleshooting

### "Connection refused" error:
- Make sure PostgreSQL is running
- Check that the port (5432) is correct
- Verify your username and password

### "Database does not exist" error:
- Create the database `mannys_toolbox` in pgAdmin4 first
- Or change the database name in DATABASE_URL to an existing database

### "Password authentication failed":
- Double-check your PostgreSQL password
- Make sure there are no extra spaces in the connection string
- Try connecting in pgAdmin4 with the same credentials to verify
