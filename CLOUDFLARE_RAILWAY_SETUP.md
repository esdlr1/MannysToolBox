# Cloudflare + Railway Setup Guide

This guide will help you connect your Cloudflare domain to Railway.

## Prerequisites

- ✅ Railway app deployed (domain: `mannystoolbox-production.up.railway.app`)
- ✅ Cloudflare account
- ✅ Domain added to Cloudflare

---

## Step 1: Get Your Railway Domain

1. Go to your Railway dashboard
2. Select your **MannysToolBox** service
3. Go to **Settings** → **Networking**
4. Your Railway domain is: `mannystoolbox-production.up.railway.app`
5. **Copy this domain** - you'll need it for Cloudflare

---

## Step 2: Add Custom Domain in Railway

1. In Railway, go to your **MannysToolBox** service
2. Go to **Settings** → **Networking** → **Public Networking**
3. Click **"+ Custom Domain"** button
4. Enter your domain (e.g., `mannystoolbox.com` or `www.mannystoolbox.com`)
5. Click **"Add Domain"**
6. Railway will show you DNS records to configure

**Important:** Railway will display:
- A **CNAME record** pointing to your Railway domain
- Or an **A record** with an IP address

---

## Step 3: Configure DNS in Cloudflare

### Option A: Root Domain (mannystoolbox.com)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Go to **DNS** → **Records**
4. **If Railway gives you a CNAME:**
   - Click **"Add record"**
   - Type: **CNAME**
   - Name: **@** (for root domain)
   - Target: `mannystoolbox-production.up.railway.app` (or Railway's CNAME target)
   - Proxy status: **DNS only** (gray cloud) initially, then **Proxied** (orange cloud) after verification
   - TTL: **Auto**
   - Click **"Save"**

5. **If Railway gives you an A record:**
   - Click **"Add record"**
   - Type: **A**
   - Name: **@**
   - IPv4 address: (Railway's IP address)
   - Proxy status: **DNS only** (gray cloud) initially
   - TTL: **Auto**
   - Click **"Save"**

### Option B: WWW Subdomain (www.mannystoolbox.com)

1. In Cloudflare DNS → Records
2. Click **"Add record"**
3. Type: **CNAME**
4. Name: **www**
5. Target: `mannystoolbox-production.up.railway.app` (or Railway's CNAME target)
6. Proxy status: **DNS only** (gray cloud) initially, then **Proxied** (orange cloud) after verification
7. TTL: **Auto**
8. Click **"Save"**

### Recommended: Both Root and WWW

For best results, set up both:
- **Root domain** (`mannystoolbox.com`) - CNAME to Railway
- **WWW subdomain** (`www.mannystoolbox.com`) - CNAME to Railway

---

## Step 4: SSL/TLS Settings in Cloudflare

1. Go to **SSL/TLS** in Cloudflare dashboard
2. Set encryption mode to: **Full** or **Full (strict)**
   - **Full**: Works with self-signed certificates (Railway's default)
   - **Full (strict)**: Requires valid SSL certificate (Railway provides this)
3. Railway automatically provides SSL certificates, so **Full (strict)** is recommended

---

## Step 5: Wait for DNS Propagation

1. DNS changes can take **5-30 minutes** to propagate
2. You can check propagation status at: https://www.whatsmydns.net
3. In Railway, the domain status will show:
   - **Pending** - waiting for DNS verification
   - **Valid** - DNS verified and ready
   - **Invalid** - DNS not configured correctly (check settings)

---

## Step 6: Update Environment Variables in Railway

Once your custom domain is active:

1. Go to Railway → **MannysToolBox** service → **Variables**
2. Update **NEXTAUTH_URL**:
   - Old: `https://mannystoolbox-production.up.railway.app`
   - New: `https://mannystoolbox.com` (or `https://www.mannystoolbox.com`)
3. Railway will automatically redeploy

---

## Step 7: Cloudflare Settings (Optional Optimizations)

### Speed & Performance

1. **Auto Minify**: Enable JavaScript, CSS, HTML minification
2. **Brotli**: Enable (better compression)
3. **HTTP/2**: Should be enabled by default
4. **HTTP/3 (with QUIC)**: Enable for faster connections

### Caching (Be Careful)

- **Caching Level**: Standard
- **Browser Cache TTL**: 4 hours (for static assets)
- **Always Online**: Enable (shows cached version if origin is down)

**Note:** Railway uses dynamic content, so aggressive caching might cause issues. Use standard caching.

### Page Rules (Optional)

If you want to add rules:
- `/api/*` - Cache Level: Bypass (for API routes)
- `/*` - Cache Level: Standard

---

## Common Issues & Solutions

### Issue: "Domain not found" in Railway

**Solution:**
- Make sure DNS records are added correctly in Cloudflare
- Wait 10-15 minutes for DNS propagation
- Verify the record type and target match Railway's requirements

### Issue: SSL Certificate Error

**Solution:**
1. In Cloudflare, go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full** (not strict) temporarily
3. Wait for Railway to provision SSL certificate
4. Then switch to **Full (strict)**

### Issue: "Too many redirects"

**Solution:**
- Check Cloudflare SSL/TLS mode (should be Full or Full strict)
- Verify Railway domain configuration
- Disable Cloudflare proxy temporarily (gray cloud) to test

### Issue: Custom domain not working

**Solution:**
1. Verify DNS records in Cloudflare match Railway's requirements
2. Check Railway's domain status (should be "Valid")
3. Wait for DNS propagation (can take up to 48 hours, usually 5-30 minutes)
4. Test with `curl` or `nslookup` to verify DNS resolution

---

## Verification Steps

### 1. Check DNS Records

```bash
# Check CNAME record
nslookup mannystoolbox.com

# Should resolve to Railway's domain or IP
```

### 2. Test Domain in Railway

1. Go to Railway → Settings → Networking
2. Your custom domain should show status: **Valid**
3. If it shows **Invalid**, check DNS records again

### 3. Test Website

1. Visit `https://mannystoolbox.com` in your browser
2. Should load your Railway application
3. Check browser console for any errors

---

## Quick Reference

### Railway Domain
- Production: `mannystoolbox-production.up.railway.app`

### Cloudflare DNS Records Needed
- Type: **CNAME**
- Name: **@** (for root) or **www** (for subdomain)
- Target: Railway's domain or CNAME target
- Proxy: **Proxied** (orange cloud) after verification

### Railway Environment Variables
- `NEXTAUTH_URL`: `https://mannystoolbox.com` (update after domain is active)

### Cloudflare SSL/TLS Mode
- **Full (strict)** - Recommended (Railway provides valid SSL)

---

## Summary Checklist

- [ ] Railway custom domain added
- [ ] DNS records configured in Cloudflare (CNAME or A record)
- [ ] SSL/TLS mode set to Full or Full (strict)
- [ ] DNS propagation waited (5-30 minutes)
- [ ] Domain verified in Railway (status: Valid)
- [ ] NEXTAUTH_URL updated in Railway variables
- [ ] Website accessible at custom domain
- [ ] SSL certificate working (HTTPS)

---

**Need Help?**
- Railway Docs: https://docs.railway.app/domains
- Cloudflare Docs: https://developers.cloudflare.com/dns
