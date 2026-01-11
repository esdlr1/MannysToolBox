# Reset PostgreSQL Password on Windows

## Method 1: Reset via Command Line (Recommended)

### Step 1: Open Command Prompt as Administrator
1. Press `Windows Key + X`
2. Select "Windows PowerShell (Admin)" or "Command Prompt (Admin)"
3. Click "Yes" if prompted by User Account Control

### Step 2: Navigate to PostgreSQL Bin Directory
The path is usually one of these:
- `C:\Program Files\PostgreSQL\18\bin`
- `C:\Program Files\PostgreSQL\16\bin`
- `C:\Program Files\PostgreSQL\15\bin`

Run this command (adjust version number if needed):
```cmd
cd "C:\Program Files\PostgreSQL\18\bin"
```

### Step 3: Try to Connect
Try connecting without a password first:
```cmd
psql -U postgres
```

If that works, you can change the password:
```sql
ALTER USER postgres WITH PASSWORD 'NewPassword123';
\q
```

### Step 4: If Step 3 Doesn't Work - Use pg_hba.conf Method

1. Find your PostgreSQL data directory (usually):
   - `C:\Program Files\PostgreSQL\18\data`
   - Or check pgAdmin4: Right-click server → Properties → Variables tab → Look for "data_directory"

2. Open `pg_hba.conf` in a text editor (as Administrator)

3. Find the line that looks like:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   ```
   Or:
   ```
   host    all             all             127.0.0.1/32            md5
   ```

4. Temporarily change it to:
   ```
   host    all             all             127.0.0.1/32            trust
   ```

5. Save the file

6. Restart PostgreSQL service:
   - Press `Windows Key + R`
   - Type `services.msc` and press Enter
   - Find "postgresql-x64-18" (or similar)
   - Right-click → Restart

7. Now connect in pgAdmin4 (password should not be required)

8. Change the password via SQL:
   - In pgAdmin4, right-click your database → Query Tool
   - Run: `ALTER USER postgres WITH PASSWORD 'YourNewPassword';`

9. Revert pg_hba.conf back to original (scram-sha-256 or md5)

10. Restart PostgreSQL service again

## Method 2: Use Windows Authentication

If PostgreSQL was installed with Windows authentication, try:
1. In pgAdmin4, use your Windows username instead of "postgres"
2. Leave password blank or use your Windows password

## Method 3: Check Installation Notes

If you installed PostgreSQL yourself:
- Check if you wrote down the password during installation
- Check installation notes or documentation
- Look in password managers (LastPass, 1Password, etc.)

## Method 4: Reinstall PostgreSQL (Last Resort)

If you don't have important data:
1. Uninstall PostgreSQL
2. Reinstall and set a password you'll remember
3. Write it down!

## After Resetting Password

Once you have a working password:
1. Connect in pgAdmin4 with the new password
2. Create the `mannys_toolbox` database
3. Update your `.env` file with the new password
