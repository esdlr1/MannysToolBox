# Step-by-Step Cloudflare Setup for Railway

Complete guide to connect your domain to Railway using Cloudflare.

---

## Prerequisites

- ✅ Domain name (e.g., `mannystoolbox.com`)
- ✅ Cloudflare account (free account works fine)
- ✅ Railway app deployed (domain: `mannystoolbox-production.up.railway.app`)
- ✅ Railway custom domain added (we'll do this in Step 2)

---

## Step 1: Add Domain to Cloudflare (If Not Already Added)

### If your domain is NOT in Cloudflare yet:

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Sign in or create a free account

2. **Add Your Site**
   - Click **"Add a Site"** or **"Add Site"** button
   - Enter your domain (e.g., `mannystoolbox.com`)
   - Click **"Add site"**

3. **Select Plan**
   - Choose **Free** plan (perfect for most needs)
   - Click **"Continue"**

4. **Cloudflare will scan your DNS records**
   - Wait for the scan to complete
   - Review the DNS records found
   - Click **"Continue"**

5. **Update Nameservers at Your Domain Registrar**
   - Cloudflare will show you 2 nameservers (e.g., `bob.ns.cloudflare.com` and `alice.ns.cloudflare.com`)
   - **Important**: Copy these nameservers
   - Go to your domain registrar (where you bought the domain: GoDaddy, Namecheap, etc.)
   - Find DNS/Nameserver settings
   - Replace existing nameservers with Cloudflare's nameservers
   - Save changes
   - Return to Cloudflare and click **"Done, check nameservers"**
   - Wait for verification (can take 24-48 hours, usually faster)

6. **Wait for Nameserver Verification**
   - Cloudflare will verify the nameservers
   - Status will show **"Active"** when ready
   - You'll receive an email when verification is complete

### If your domain is ALREADY in Cloudflare:

- Skip to Step 2 below

---

## Step 2: Add Custom Domain in Railway

**Do this AFTER your domain is active in Cloudflare:**

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Go to your **MannysToolBox** project
   - Select **MannysToolBox** service

2. **Add Custom Domain**
   - Click **Settings** tab
   - Scroll to **Networking** section
   - Under **Public Networking**, click **"+ Custom Domain"**

3. **Enter Your Domain**
   - Enter your domain: `mannystoolbox.com` (or `www.mannystoolbox.com`)
   - Click **"Add Domain"**

4. **Railway will show DNS records to add**
   - Railway will display:
     - A **CNAME record** pointing to `mannystoolbox-production.up.railway.app`
     - OR an **A record** with an IP address
   - **Copy this information** - you'll need it in Step 3

---

## Step 3: Configure DNS Records in Cloudflare

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Select your domain

2. **Go to DNS Settings**
   - Click **"DNS"** in the left sidebar
   - Click **"Records"** tab

3. **Add DNS Record for Root Domain**

   **Option A: If Railway gives you a CNAME (Most Common)**
   
   - Click **"Add record"**
   - **Type**: Select **CNAME**
   - **Name**: Enter **@** (for root domain like `mannystoolbox.com`)
   - **Target**: Enter Railway's domain: `mannystoolbox-production.up.railway.app` (or Railway's CNAME target)
   - **Proxy status**: Click the **gray cloud** (DNS only) initially
     - ⚠️ **Important**: Start with gray cloud (DNS only) for Railway verification
     - After Railway verifies, you can switch to orange cloud (Proxied)
   - **TTL**: Select **Auto**
   - Click **"Save"**

   **Option B: If Railway gives you an A record (Less Common)**
   
   - Click **"Add record"**
   - **Type**: Select **A**
   - **Name**: Enter **@**
   - **IPv4 address**: Enter Railway's IP address
   - **Proxy status**: Click the **gray cloud** (DNS only)
   - **TTL**: Select **Auto**
   - Click **"Save"**

4. **Add DNS Record for WWW Subdomain (Optional but Recommended)**

   - Click **"Add record"**
   - **Type**: Select **CNAME**
   - **Name**: Enter **www**
   - **Target**: Enter Railway's domain: `mannystoolbox-production.up.railway.app`
   - **Proxy status**: Click the **gray cloud** (DNS only) initially
   - **TTL**: Select **Auto**
   - Click **"Save"**

5. **Remove or Keep Existing Records**
   - If there are existing **A** or **CNAME** records for **@** or **www**, you can:
     - **Delete** them (recommended if they point to old servers)
     - **Keep** them if they're needed for other services
   - Your new Railway records will override them

---

## Step 4: Wait for DNS Propagation

1. **DNS changes take time**
   - Usually: **5-30 minutes**
   - Maximum: **24-48 hours** (rare)
   - Check status in Railway dashboard

2. **Verify in Railway**
   - Go to Railway → Settings → Networking
   - Your custom domain should show status:
     - **Pending** - Still waiting for DNS verification
     - **Valid** - DNS verified and active ✅
     - **Invalid** - DNS not configured correctly (check settings)

3. **Check DNS Propagation (Optional)**
   - Visit: https://www.whatsmydns.net
   - Enter your domain
   - Check if it resolves to Railway's domain/IP

---

## Step 5: Configure SSL/TLS in Cloudflare

Once Railway verifies your domain:

1. **Go to Cloudflare Dashboard**
   - Select your domain
   - Click **"SSL/TLS"** in the left sidebar

2. **Set Encryption Mode**
   - Go to **"Overview"** tab
   - Set encryption mode to: **Full (strict)**
     - Railway provides valid SSL certificates
     - **Full (strict)** ensures secure connections
   - If you get errors, temporarily use **Full** mode

3. **SSL/TLS Settings Explained:**
   - **Off**: No SSL (not recommended)
   - **Flexible**: SSL between visitor and Cloudflare only (not secure)
   - **Full**: SSL everywhere, accepts self-signed certificates
   - **Full (strict)**: SSL everywhere, requires valid certificates ✅ (Recommended)

---

## Step 6: Enable Cloudflare Proxy (After Railway Verification)

**After Railway shows your domain as "Valid":**

1. **Go to DNS Records in Cloudflare**
   - DNS → Records

2. **Enable Proxy for Your Records**
   - Find your **@** (root) CNAME record
   - Click the **gray cloud** icon → It should turn **orange** (Proxied)
   - Do the same for **www** record if you added it
   - ⚠️ **Orange cloud = Proxied** (routes through Cloudflare CDN)
   - Gray cloud = DNS only (direct to Railway)

3. **Benefits of Orange Cloud (Proxied):**
   - Faster loading (Cloudflare CDN)
   - DDoS protection
   - Additional security features
   - Hide your Railway IP address

---

## Step 7: Update Railway Environment Variables

Once your custom domain is active:

1. **Go to Railway Dashboard**
   - Select **MannysToolBox** service
   - Go to **Variables** tab

2. **Update NEXTAUTH_URL**
   - Find **NEXTAUTH_URL** variable
   - Click **Edit** (pencil icon)
   - Change from: `https://mannystoolbox-production.up.railway.app`
   - Change to: `https://mannystoolbox.com` (or your custom domain)
   - Click **"Save"**

3. **Railway will automatically redeploy**
   - Wait for deployment to complete
   - Your app will now use the custom domain

---

## Step 8: Test Your Domain

1. **Visit Your Domain**
   - Go to: `https://mannystoolbox.com` (or your domain)
   - Should load your Railway application

2. **Check SSL Certificate**
   - Look for padlock icon in browser
   - Should show valid SSL certificate

3. **Test WWW Subdomain (If Configured)**
   - Visit: `https://www.mannystoolbox.com`
   - Should also work

---

## Quick Reference: DNS Records Setup

### Root Domain (mannystoolbox.com)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | @ | `mannystoolbox-production.up.railway.app` | Gray (DNS only) → Orange (Proxied) | Auto |

### WWW Subdomain (www.mannystoolbox.com)

| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | www | `mannystoolbox-production.up.railway.app` | Gray (DNS only) → Orange (Proxied) | Auto |

---

## Troubleshooting

### Issue: Domain shows "Pending" in Railway

**Solution:**
- Wait 5-30 minutes for DNS propagation
- Verify DNS records are correct in Cloudflare
- Make sure you used **gray cloud** (DNS only) initially
- Check Railway's DNS requirements match your records

### Issue: Domain shows "Invalid" in Railway

**Solution:**
- Double-check DNS records match Railway's requirements
- Verify the target domain is correct
- Make sure no conflicting records exist
- Try removing and re-adding the domain in Railway

### Issue: SSL Certificate Error

**Solution:**
- In Cloudflare, set SSL/TLS mode to **Full** (not strict) temporarily
- Wait for Railway to provision SSL certificate
- Then switch back to **Full (strict)**
- Clear browser cache and try again

### Issue: "Too many redirects"

**Solution:**
- Check Cloudflare SSL/TLS mode (should be Full or Full strict)
- Verify Railway domain configuration
- Temporarily disable Cloudflare proxy (gray cloud) to test
- Check if both www and root domain point to same place

### Issue: Domain not resolving

**Solution:**
- Check DNS records are saved in Cloudflare
- Verify nameservers are correct at domain registrar
- Wait longer for DNS propagation (can take up to 48 hours)
- Use `nslookup` or online DNS checker to verify

---

## Summary Checklist

- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at domain registrar
- [ ] Nameserver verification complete (Cloudflare shows "Active")
- [ ] Custom domain added in Railway
- [ ] DNS records configured in Cloudflare (CNAME to Railway)
- [ ] DNS records set to gray cloud (DNS only) initially
- [ ] Waited for DNS propagation (5-30 minutes)
- [ ] Railway shows domain status as "Valid"
- [ ] SSL/TLS mode set to "Full (strict)" in Cloudflare
- [ ] Enabled Cloudflare proxy (orange cloud) after verification
- [ ] Updated NEXTAUTH_URL in Railway variables
- [ ] Tested domain - website loads correctly
- [ ] SSL certificate working (padlock icon visible)

---

## Need Help?

- **Cloudflare Support**: https://support.cloudflare.com
- **Railway Docs**: https://docs.railway.app/domains
- **Check DNS Propagation**: https://www.whatsmydns.net

---

**You're all set!** Your domain should now be connected to Railway. 🎉
