# Correct Railway Database Connection Details

## From DATABASE_PUBLIC_URL

```
postgresql://postgres:YBfAoa0ofDjQVWxfYkVaaspwZSFocyay@tramway.proxy.rlwy.net:55342/railway
```

## Parsed Connection Details

- **Host**: `tramway.proxy.rlwy.net`
- **Port**: `55342` ⚠️ **NOT 5432!**
- **Database**: `railway`
- **Username**: `postgres`
- **Password**: `YBfAoa0ofDjQVWxfYkVaaspwZSFocyay` (note: zero `0`, not letter `O`)

---

## pgAdmin 4 Configuration

### Connection Tab:
- **Host name/address**: `tramway.proxy.rlwy.net`
- **Port**: `55342` ⚠️ **Important: Use 55342, not 5432!**
- **Maintenance database**: `railway`
- **Username**: `postgres`
- **Password**: `YBfAoa0ofDjQVWxfYkVaaspwZSFocyay`
- **Save password?**: ✅ Check this

### SSL Tab:
- **SSL mode**: `require`

---

## Common Mistakes

### ❌ Wrong Port
- Using `5432` (default PostgreSQL port)
- **Correct**: Use `55342` (Railway's public proxy port)

### ❌ Wrong Host
- Using `postgres.railway.internal` (internal, won't work)
- **Correct**: Use `tramway.proxy.rlwy.net` (public proxy)

### ❌ Wrong Password Character
- Using `YBfAoaOofDjQVWxfYkVaaspwZSFocyay` (letter O)
- **Correct**: `YBfAoa0ofDjQVWxfYkVaaspwZSFocyay` (zero 0)

---

## Quick Setup Steps

1. **Right-click** "MannysToolBox" server → **Properties**
2. **Connection tab**:
   - Host: `tramway.proxy.rlwy.net`
   - Port: `55342`
   - Database: `railway`
   - Username: `postgres`
   - Password: `YBfAoa0ofDjQVWxfYkVaaspwZSFocyay`
3. **SSL tab**: Set to `require`
4. **Save** and **Connect**

---

## After Connecting

Once connected, run the SQL from `docs/RAILWAY_SQL_CREATE_ADMIN.sql` to create the Super Admin user.
