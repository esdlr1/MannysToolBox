# PostgreSQL Password Reset Guide

## Problem: Password Authentication Failed

If you're getting "password authentication failed for user 'postgres'", you have a few options:

## Option 1: Try Common Default Passwords

Sometimes PostgreSQL is installed with a default password. Try these common ones:
- `postgres` (same as username)
- `admin`
- `root`
- `password`
- (blank/empty - just leave it empty)

## Option 2: Check if Password is Saved in pgAdmin4

1. In pgAdmin4, look at your existing servers
2. If "PostgreSQL 18" is already connected (no lock icon), the password might be saved
3. Try connecting to it - if it connects, the password is working

## Option 3: Reset PostgreSQL Password (Windows)

### Method A: Using pgAdmin4 (if you can access another server)

If you have another working PostgreSQL connection, you can reset the password via SQL.

### Method B: Using Command Line (if you have access)

1. Open Command Prompt as Administrator
2. Navigate to PostgreSQL bin directory (usually):
   ```
   cd "C:\Program Files\PostgreSQL\18\bin"
   ```
3. Run:
   ```
   psql -U postgres
   ```
4. If that works, change password:
   ```sql
   ALTER USER postgres WITH PASSWORD 'YourNewPassword';
   ```

### Method C: Edit pg_hba.conf (Advanced)

1. Find `pg_hba.conf` file (usually in PostgreSQL data directory)
2. Temporarily change authentication method to `trust`
3. Restart PostgreSQL service
4. Connect without password
5. Change password
6. Revert pg_hba.conf changes

## Option 4: Use Windows Authentication

If PostgreSQL was installed with Windows authentication, you might be able to connect using your Windows user account instead of 'postgres'.

## Option 5: Reinstall PostgreSQL (Last Resort)

If you can't recover the password and don't have important data, you could reinstall PostgreSQL and set a new password during installation.

## Quick Test: Try Connecting with Different Methods

In pgAdmin4, try:
1. Different username (your Windows username)
2. Leave password blank
3. Check if "Save password?" is enabled and try toggling it

## After Resetting Password

Once you have the correct password:
1. Update your connection in pgAdmin4
2. Create the `mannys_toolbox` database
3. Use the password in your `.env` file
