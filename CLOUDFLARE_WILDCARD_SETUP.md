# Cloudflare Wildcard DNS Setup for Tool Subdomains

Complete guide for setting up wildcard DNS to support tool subdomains like `tool1.mannystoolbox.com`, `tool2.mannystoolbox.com`, etc.

## Your Architecture

```
mannystoolbox.com                    → Main hub (homepage with tool dropdown)
www.mannystoolbox.com                → Main hub (optional)
*.mannystoolbox.com                  → Individual tools (wildcard)
  ├── estimate-comparison.mannystoolbox.com
  ├── tool2.mannystoolbox.com
  ├── tool3.mannystoolbox.com
  └── ... (any tool subdomain)
```

---

## Required DNS Records in Cloudflare

You need **THREE** DNS records:

### 1. Root Domain (@) - Main Hub
| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | @ | `4yli4t3i.up.railway.app` | DNS only (gray) → Proxied (orange) | Auto |

### 2. WWW Subdomain - Main Hub (Optional but Recommended)
| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | www | `4yli4t3i.up.railway.app` | DNS only (gray) → Proxied (orange) | Auto |

### 3. Wildcard Subdomain (*) - All Tools ⭐ **IMPORTANT**
| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | * | `4yli4t3i.up.railway.app` | DNS only (gray) → Proxied (orange) | Auto |

**The wildcard (*) record handles ALL tool subdomains!**

---

## Step-by-Step Setup in Cloudflare

### Step 1: Root Domain (@) - Already Done ✅

1. Go to Cloudflare → DNS → Records
2. Find the **@** CNAME record pointing to Railway
3. **Target**: `4yli4t3i.up.railway.app` ✅
4. **Proxy**: DNS only (gray cloud) for Railway verification
5. ✅ **Should already be set up**

### Step 2: WWW Subdomain

1. Go to Cloudflare → DNS → Records
2. Find the **www** CNAME record
3. **Edit** the record:
   - **Type**: CNAME
   - **Name**: www
   - **Target/Content**: `4yli4t3i.up.railway.app`
   - **Proxy**: DNS only (gray cloud) initially
   - **TTL**: Auto
4. Click **Save**

### Step 3: Wildcard Subdomain (*) - ADD THIS! ⭐

1. Go to Cloudflare → DNS → Records
2. Click **"+ Add record"** button
3. Configure the record:
   - **Type**: Select **CNAME**
   - **Name**: Enter **`*`** (asterisk/star character)
   - **Target/Content**: Enter **`4yli4t3i.up.railway.app`**
   - **Proxy status**: Click **gray cloud** (DNS only) initially
     - ⚠️ **Important**: Start with gray cloud (DNS only) for Railway verification
     - After Railway verifies, you can enable proxy (orange cloud)
   - **TTL**: Select **Auto**
4. Click **Save**

**Result**: All tool subdomains will now point to Railway!

---

## How Wildcard DNS Works

When you add a wildcard CNAME record (`*`), it catches **ALL** subdomains that don't have a specific record.

### Examples:

- `estimate-comparison.mannystoolbox.com` → Matches `*` → Points to Railway ✅
- `tool2.mannystoolbox.com` → Matches `*` → Points to Railway ✅
- `tool3.mannystoolbox.com` → Matches `*` → Points to Railway ✅
- `anything.mannystoolbox.com` → Matches `*` → Points to Railway ✅
- `www.mannystoolbox.com` → Matches specific `www` record → Points to Railway ✅
- `mannystoolbox.com` → Matches `@` record → Points to Railway ✅

### Priority Order:

1. **Specific records** (www, @) are checked first
2. **Wildcard (*)** matches everything else
3. If no match, domain doesn't resolve

---

## Railway Configuration

### Add Custom Domains in Railway

You have two options:

**Option A: Add Individual Tool Domains (Not Recommended)**

- ❌ You'd need to add each tool subdomain manually
- ❌ Not scalable for many tools

**Option B: Railway Handles Wildcard Automatically (Recommended) ✅**

Railway automatically handles wildcard subdomains! When you:
1. Add the root domain (`mannystoolbox.com`) in Railway
2. Railway's middleware detects subdomains
3. Your application handles the routing via `middleware.ts`

**You DON'T need to add each tool subdomain in Railway!**

### What to Add in Railway:

1. **Root domain**: `mannystoolbox.com` ✅ (already added)
2. **WWW subdomain**: `www.mannystoolbox.com` (optional, but recommended)
3. **Wildcard**: Railway handles this automatically via DNS + your middleware

---

## Final DNS Records Setup

After setup, your Cloudflare DNS should have:

| Type | Name | Target | Proxy | Purpose |
|------|------|--------|-------|---------|
| CNAME | @ | `4yli4t3i.up.railway.app` | DNS only → Proxied | Root domain (main hub) |
| CNAME | www | `4yli4t3i.up.railway.app` | DNS only → Proxied | WWW subdomain |
| CNAME | * | `4yli4t3i.up.railway.app` | DNS only → Proxied | All tool subdomains ⭐ |

---

## How Your Middleware Handles Subdomains

Your `middleware.ts` already handles subdomain routing:

```typescript
// middleware.ts detects subdomain from request
const subdomain = getSubdomain(hostname) // e.g., "estimate-comparison"

// Looks up tool by subdomain
const tool = getToolBySubdomain(subdomain)

// Routes to /tools/[toolId]
if (tool) {
  // Rewrites route to tool page
}
```

With wildcard DNS, all subdomains reach your Railway app, and middleware handles the routing!

---

## Step-by-Step Complete Setup

### 1. Cloudflare DNS Records

**Root Domain (@)**:
- ✅ Already configured
- Target: `4yli4t3i.up.railway.app`
- Proxy: DNS only (gray) for verification

**WWW Subdomain**:
1. Edit existing `www` CNAME
2. Change target to: `4yli4t3i.up.railway.app`
3. Proxy: DNS only (gray)
4. Save

**Wildcard (*)** ⭐:
1. Click "+ Add record"
2. Type: CNAME
3. Name: `*` (asterisk)
4. Target: `4yli4t3i.up.railway.app`
5. Proxy: DNS only (gray)
6. Save

### 2. Railway Custom Domains

**Add in Railway**:
1. Root domain: `mannystoolbox.com` ✅ (already added)
2. WWW subdomain: `www.mannystoolbox.com` (optional, but recommended)

**Don't add**: Individual tool subdomains - wildcard DNS handles them!

### 3. Wait for Verification

- Wait 5-30 minutes for DNS propagation
- Railway will verify root domain and www (if added)
- Wildcard subdomains work automatically via DNS

### 4. After Verification

1. **Enable Cloudflare Proxy** (optional):
   - Change all CNAME records from gray cloud → orange cloud
   - Benefits: CDN, DDoS protection, faster loading

2. **Update NEXTAUTH_URL in Railway**:
   - Change to: `https://mannystoolbox.com`

3. **Test Your Setup**:
   - `https://mannystoolbox.com` → Main hub ✅
   - `https://www.mannystoolbox.com` → Main hub ✅
   - `https://estimate-comparison.mannystoolbox.com` → Tool page ✅
   - `https://any-tool.mannystoolbox.com` → Tool page (if registered) ✅

---

## Testing Tool Subdomains

After setup, test:

1. **Existing Tool**:
   - Visit: `https://estimate-comparison.mannystoolbox.com`
   - Should load the Estimate Comparison Tool
   - Middleware detects subdomain and routes correctly

2. **New Tool** (after adding):
   - Add tool in `lib/tools.ts` with subdomain: `tool2`
   - Visit: `https://tool2.mannystoolbox.com`
   - Should automatically work (no DNS changes needed!)

3. **Non-existent Tool**:
   - Visit: `https://fake-tool.mannystoolbox.com`
   - Middleware doesn't find tool → Shows 404 or redirects

---

## Important Notes

### Wildcard DNS Benefits:
- ✅ No need to add DNS records for each new tool
- ✅ Add tool in code → Subdomain automatically works
- ✅ Scales infinitely (as many tools as you want)

### Wildcard DNS Limitations:
- ⚠️ All subdomains point to Railway (even invalid ones)
- ⚠️ Your middleware must handle routing/validation
- ⚠️ You can't point specific subdomains elsewhere (unless you add specific record before wildcard)

### Cloudflare Proxy with Wildcards:
- ✅ Works with wildcard records
- ✅ All subdomains get CDN benefits
- ⚠️ Start with DNS only (gray) for Railway verification
- ✅ Enable proxy (orange) after verification

---

## Troubleshooting

### Tool Subdomain Not Working

**Solution:**
1. Verify wildcard DNS record exists (`*` CNAME)
2. Check DNS propagation (can take up to 48 hours)
3. Verify tool is registered in `lib/tools.ts`
4. Check middleware.ts is handling subdomain correctly
5. Test with `nslookup tool-name.mannystoolbox.com`

### DNS Propagation Taking Long

**Solution:**
- DNS changes can take 5-30 minutes (usually)
- Maximum: 24-48 hours
- Check at: https://www.whatsmydns.net
- Enter: `*.mannystoolbox.com` to check wildcard

### Subdomain Routes to Wrong Place

**Solution:**
- Check if specific DNS record exists (specific records override wildcard)
- Verify middleware routing logic
- Check Railway domain configuration
- Clear browser cache

---

## Summary Checklist

- [ ] Root domain (@) CNAME configured ✅
- [ ] WWW subdomain CNAME configured
- [ ] **Wildcard (*) CNAME added** ⭐
- [ ] All records set to DNS only (gray cloud) for verification
- [ ] Root domain added in Railway
- [ ] WWW domain added in Railway (optional)
- [ ] Waited for DNS propagation (5-30 minutes)
- [ ] Railway shows domains as "Valid"
- [ ] Enabled Cloudflare proxy (orange cloud) - optional
- [ ] Updated NEXTAUTH_URL in Railway variables
- [ ] Tested root domain
- [ ] Tested www subdomain
- [ ] Tested tool subdomain (estimate-comparison.mannystoolbox.com)

---

**The wildcard DNS record is the key to supporting unlimited tool subdomains!** 🎉
