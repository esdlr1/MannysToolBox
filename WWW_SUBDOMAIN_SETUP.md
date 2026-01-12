# WWW Subdomain Setup Guide

## Current Situation

- **Root domain (@)**: Points to Railway ✅
- **WWW subdomain**: Points to Squarespace (needs update)

## Options

### Option 1: Update WWW to Railway (Recommended) ✅

**Benefits:**
- Both `mannystoolbox.com` and `www.mannystoolbox.com` work
- Better user experience (no broken links)
- Consistent routing

**Steps:**
1. Go to Cloudflare Dashboard → DNS → Records
2. Find the **www** CNAME record
3. Click **Edit** (or click the row)
4. **Target/Content**: Change to `4yli4t3i.up.railway.app` (same as root domain)
5. **Proxy status**: Change to **DNS only** (gray cloud) for Railway verification
6. **TTL**: Keep as **Auto**
7. Click **Save**

**Result:**
- `mannystoolbox.com` → Railway
- `www.mannystoolbox.com` → Railway

---

### Option 2: Delete WWW Record

**Use this if:**
- You only want root domain (no www)
- You don't need www subdomain

**Steps:**
1. Go to Cloudflare Dashboard → DNS → Records
2. Find the **www** CNAME record
3. Click **Delete**
4. Confirm deletion

**Result:**
- `mannystoolbox.com` → Railway ✅
- `www.mannystoolbox.com` → Will not work (404 or no response)

---

### Option 3: Keep WWW Pointing to Squarespace

**Use this if:**
- You want www to go to a different service (Squarespace)
- You're using both services

**Steps:**
- Do nothing! Leave it as is

**Result:**
- `mannystoolbox.com` → Railway
- `www.mannystoolbox.com` → Squarespace

---

## Recommended: Option 1 (Update WWW to Railway)

### Detailed Steps:

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Select your domain: `mannystoolbox.com`
   - Click **DNS** → **Records**

2. **Find WWW CNAME Record**
   - Look for the record with:
     - Type: **CNAME**
     - Name: **www**
     - Content: `ext-sq.squaresp...` (currently points to Squarespace)

3. **Edit the Record**
   - Click the **Edit** button (or click anywhere on the row)
   - A modal/form will open

4. **Update the Record**
   - **Type**: Keep as **CNAME** (don't change)
   - **Name**: Keep as **www** (don't change)
   - **Target/Content**: Change from `ext-sq.squarespace.com` to `4yli4t3i.up.railway.app`
   - **Proxy status**: Click the **orange cloud** icon → It should turn **gray** (DNS only)
   - **TTL**: Keep as **Auto**

5. **Save Changes**
   - Click **Save** button
   - The record should now show:
     - Name: `www`
     - Content: `4yli4t3i.up.railway.app`
     - Proxy: Gray cloud (DNS only)

6. **Wait for Verification**
   - Wait 5-30 minutes for DNS propagation
   - Railway will verify both root and www domains
   - Both should show "Valid" in Railway

---

## Add WWW Domain in Railway (After DNS Update)

After updating the www CNAME in Cloudflare:

1. **Go to Railway Dashboard**
   - Select your **MannysToolBox** service
   - Go to **Settings** → **Networking**

2. **Add WWW Custom Domain**
   - Click **"+ Custom Domain"**
   - Enter: `www.mannystoolbox.com`
   - Click **"Add Domain"**

3. **Railway will show DNS instructions**
   - Type: CNAME
   - Name: www
   - Value: `4yli4t3i.up.railway.app` (should already match!)

4. **Wait for Verification**
   - Railway will verify the DNS record
   - Status should show "Valid" when ready

---

## Final Configuration

After both are set up:

### Cloudflare DNS Records:
| Type | Name | Target | Proxy | Status |
|------|------|--------|-------|--------|
| CNAME | @ | `4yli4t3i.up.railway.app` | DNS only (gray) | ✅ |
| CNAME | www | `4yli4t3i.up.railway.app` | DNS only (gray) | ✅ |

### Railway Domains:
- ✅ `mannystoolbox.com` → Valid
- ✅ `www.mannystoolbox.com` → Valid

### After Railway Verification:
- You can enable Cloudflare proxy (orange cloud) if desired
- Update `NEXTAUTH_URL` in Railway to your primary domain

---

## Testing

After setup, test:
- ✅ `https://mannystoolbox.com` → Should load Railway app
- ✅ `https://www.mannystoolbox.com` → Should load Railway app

---

## Troubleshooting

### WWW Still Points to Squarespace

**Solution:**
- Clear browser cache
- Wait longer for DNS propagation (up to 48 hours)
- Verify DNS record in Cloudflare is correct
- Check Railway domain status

### WWW Shows 404 or Error

**Solution:**
- Make sure www domain is added in Railway
- Verify DNS record points to correct Railway domain
- Wait for DNS propagation
- Check Railway deployment is running

---

**Recommendation: Update WWW to Railway (Option 1)** - This gives you the best user experience! 🎉
