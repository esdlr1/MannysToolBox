# Architecture Explanation & Production Setup Guide

## Understanding the Architecture

### This is a **Full-Stack Next.js Application**

Your application uses **Next.js**, which is a **full-stack React framework**. This means:

- **Frontend (React)**: Pages and components in `app/` folder
  - `app/page.tsx` - Home page
  - `app/tools/[toolId]/page.tsx` - Tool pages
  - `components/` - Reusable UI components

- **Backend (API Routes)**: Server-side logic in `app/api/` folder
  - `app/api/auth/` - Authentication endpoints
  - `app/api/tools/` - Tool API endpoints
  - `app/api/daily-notepad/` - Daily notepad endpoints
  - All your backend logic lives here

- **Database**: Prisma ORM connects to PostgreSQL
  - `prisma/schema.prisma` - Database schema
  - `lib/prisma.ts` - Database client

**Why this architecture?**
- ✅ Single codebase to maintain
- ✅ Shared TypeScript types between frontend and backend
- ✅ Easier deployment (one app, not two separate servers)
- ✅ Built-in API routing
- ✅ Server-side rendering for better performance
- ✅ This is the modern standard for web apps (used by companies like Vercel, Netflix, TikTok)

### Traditional vs Next.js Architecture

**Traditional Approach** (what you might be thinking of):
```
Frontend (React) → API Server (Express/FastAPI) → Database
     ↓                    ↓
  Separate           Separate
  Deployment         Deployment
```

**Your Next.js Approach**:
```
Next.js App (Frontend + Backend in one)
     ↓
  Database
```

Both frontend pages AND backend API routes run in the **same server/process**.

---

## Why Production Isn't Working

Looking at the errors you're seeing:

1. **Certificate Error** (`NET::ERR_CERT_COMMON_NAME_INVALID`)
   - Railway needs SSL certificates configured for subdomains
   - Your subdomain `estimate-audit.mannystoolbox.com` doesn't have a valid certificate

2. **404 Not Found**
   - The subdomain might not be properly configured in Railway
   - DNS might not be pointing to Railway correctly
   - Or Railway doesn't know about the subdomain

---

## How to Fix Production

### Step 1: Check Main Domain First

Before fixing subdomains, make sure the **main domain works**:
- Go to: `https://mannystoolbox.com` or `https://www.mannystoolbox.com`
- This should work first!

### Step 2: Configure Railway Domains

1. **Go to Railway Dashboard**
   - Navigate to: Railway → Your Project → MannysToolBox Service → Settings → Domains

2. **Add Main Domain** (if not already added)
   - Domain: `mannystoolbox.com`
   - Railway will automatically add `www.mannystoolbox.com`

3. **Add Wildcard Domain for Subdomains**
   - Railway supports wildcard domains
   - Add: `*.mannystoolbox.com`
   - This will automatically handle ALL subdomains:
     - `estimate-audit.mannystoolbox.com`
     - `estimate-comparison.mannystoolbox.com`
     - `daily-notepad.mannystoolbox.com`

### Step 3: Configure DNS Records

In your DNS provider (where you bought `mannystoolbox.com`):

1. **Add CNAME record for main domain:**
   ```
   Type: CNAME
   Name: www
   Value: [Railway-provided domain]
   TTL: 3600
   ```

2. **Add wildcard CNAME for subdomains:**
   ```
   Type: CNAME
   Name: *
   Value: [Railway-provided domain]
   TTL: 3600
   ```

   **OR** add specific subdomains:
   ```
   Type: CNAME
   Name: estimate-audit
   Value: [Railway-provided domain]
   TTL: 3600
   
   Type: CNAME
   Name: estimate-comparison
   Value: [Railway-provided domain]
   TTL: 3600
   
   Type: CNAME
   Name: daily-notepad
   Value: [Railway-provided domain]
   TTL: 3600
   ```

3. **Add A record for root domain** (if Railway requires it):
   ```
   Type: A
   Name: @
   Value: [Railway-provided IP address]
   TTL: 3600
   ```

### Step 4: Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours
- Usually takes 15-30 minutes
- Check with: https://www.whatsmydns.net

### Step 5: Railway Auto-SSL

- Railway automatically provisions SSL certificates for your domains
- Once DNS is configured correctly, Railway will:
  1. Detect your domain
  2. Request SSL certificate (Let's Encrypt)
  3. Configure HTTPS automatically
- This takes 5-10 minutes after DNS is correct

---

## Alternative: Access Tools via Main Domain

If subdomains are too complex, you can access tools via the main domain:

**Instead of:** `https://estimate-audit.mannystoolbox.com`

**Use:** `https://mannystoolbox.com/tools/estimate-audit`

This will work immediately once the main domain is configured!

---

## Testing Locally

To test subdomain routing locally:

1. **Edit your hosts file** (Windows):
   ```
   C:\Windows\System32\drivers\etc\hosts
   ```

2. **Add these lines:**
   ```
   127.0.0.1 estimate-audit.localhost
   127.0.0.1 estimate-comparison.localhost
   127.0.0.1 daily-notepad.localhost
   ```

3. **Access via:**
   - `http://estimate-audit.localhost:3000`
   - `http://estimate-comparison.localhost:3000`
   - `http://daily-notepad.localhost:3000`

---

## Summary

- ✅ **Architecture**: Next.js is a full-stack framework (frontend + backend in one)
- ✅ **This is normal and modern** - many companies use this approach
- ✅ **Production issue**: Subdomains need DNS and SSL configuration
- ✅ **Quick fix**: Use main domain with `/tools/[toolId]` paths
- ✅ **Proper fix**: Configure wildcard DNS and Railway domains

The code is correct - it's just a domain/DNS configuration issue!
