# Environment Variables - Complete Guide

This document explains all environment variables used in Manny's ToolBox.

---

## 🔴 REQUIRED Variables

These variables **must** be set for the application to work.

### 1. `DATABASE_URL`
**Required**: Yes  
**Type**: String (PostgreSQL connection string)

PostgreSQL database connection string.

**Format:**
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
```

**Example (Local):**
```env
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/mannys_toolbox?schema=public"
```

**Example (Production):**
```env
DATABASE_URL="postgresql://user:password@db.example.com:5432/mannys_toolbox?schema=public"
```

**How to get it:**
1. Open pgAdmin4
2. Right-click your PostgreSQL server → Properties
3. Note: Host, Port, Username, Password
4. Create database: `mannys_toolbox`
5. Format as shown above

---

### 2. `NEXTAUTH_URL`
**Required**: Yes  
**Type**: String (URL)

The base URL of your application.

**Local Development:**
```env
NEXTAUTH_URL="http://localhost:3000"
```

**Production:**
```env
NEXTAUTH_URL="https://yourdomain.com"
```

**Important:**
- Must match the exact URL users access
- Include `http://` or `https://`
- Don't include trailing slash

---

### 3. `NEXTAUTH_SECRET`
**Required**: Yes  
**Type**: String (Base64 encoded)

Secret key for encrypting NextAuth sessions.

**Generate it:**
```powershell
# PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```bash
# Linux/Mac
openssl rand -base64 32
```

**Example:**
```env
NEXTAUTH_SECRET="iuXnHmsxflc5XtVrX0BF799MyZXUka/ub28IHnlocDg="
```

**Important:**
- Use a unique, random string
- Keep it secret
- Different for each environment

---

### 4. `RESEND_API_KEY`
**Required**: Yes (for Daily Notepad tool)  
**Type**: String

Resend API key for sending emails.

**Get it:**
1. Go to https://resend.com
2. Sign up for a free account
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `re_`)

**Example:**
```env
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Free Tier:**
- 3,000 emails/month
- 100 emails/day

---

### 5. `EMAIL_FROM`
**Required**: Yes (for Daily Notepad tool)  
**Type**: String (Email address)

From email address for all outgoing emails.

**Testing (Resend Test Domain):**
```env
EMAIL_FROM="onboarding@resend.dev"
```

**Production (Your Domain):**
```env
EMAIL_FROM="noreply@mannystoolbox.com"
```

**Important:**
- Must be verified in Resend dashboard
- For production, verify your own domain
- For testing, use Resend's test domain

---

## 🟡 OPTIONAL Variables

These variables have defaults but can be customized.

### 6. `OPENAI_API_KEY`
**Required**: No (only for AI features)  
**Type**: String  
**Default**: None

OpenAI API key for AI-powered features (Estimate Comparison Tool).

**Get it:**
1. Go to https://platform.openai.com
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

**Example:**
```env
OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Note:**
- Leave empty if not using AI features
- Required for Estimate Comparison Tool
- Not needed for Daily Notepad tool

---

### 7. `OPENAI_MODEL`
**Required**: No  
**Type**: String  
**Default**: `gpt-4o-mini`

OpenAI model to use for AI features.

**Options:**
- `gpt-4o-mini` - Cheapest, fastest (recommended)
- `gpt-4o` - More capable, slightly slower
- `gpt-4-turbo-preview` - Legacy option

**Example:**
```env
OPENAI_MODEL="gpt-4o-mini"
```

---

### 8. `DAILY_NOTEPAD_DEADLINE_HOUR`
**Required**: No  
**Type**: Number (0-23)  
**Default**: `9`

Deadline hour for daily notepad submissions (24-hour format).

**Examples:**
```env
DAILY_NOTEPAD_DEADLINE_HOUR=9    # 9 AM
DAILY_NOTEPAD_DEADLINE_HOUR=8    # 8 AM
DAILY_NOTEPAD_DEADLINE_HOUR=17   # 5 PM
```

---

### 9. `UPLOAD_DIR`
**Required**: No  
**Type**: String (Path)  
**Default**: `uploads/daily-notepad`

Directory for storing uploaded images.

**Relative Path (Recommended):**
```env
UPLOAD_DIR="uploads/daily-notepad"
```

**Absolute Path:**
```env
UPLOAD_DIR="/var/www/uploads/daily-notepad"
```

**Note:**
- Relative paths are relative to project root
- Directory is created automatically if it doesn't exist

---

### 10. `CRON_SECRET`
**Required**: No (recommended for production)  
**Type**: String  
**Default**: None

Secret key for authenticating cron job requests.

**Generate it:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example:**
```env
CRON_SECRET="your-random-secret-key-here"
```

**Usage:**
- Used to secure scheduled job endpoints
- Set in your cron service (cron-job.org, etc.)
- Add as Authorization header: `Bearer YOUR_SECRET`

**Cron Job Setup:**
When calling cron endpoints, add header:
```
Authorization: Bearer your-cron-secret-key-here
```

---

### 11. `NODE_ENV`
**Required**: No  
**Type**: String  
**Default**: `development`

Node environment mode.

**Options:**
- `development` - Development mode (verbose logs, hot reload)
- `production` - Production mode (optimized, minimal logs)
- `test` - Testing mode

**Example:**
```env
NODE_ENV="production"
```

**Note:**
- Usually set automatically by hosting platform
- Affects logging, error handling, optimizations

---

## 📋 Complete .env Template

Copy this template and fill in your values:

```env
# REQUIRED - Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mannys_toolbox?schema=public"

# REQUIRED - NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# REQUIRED - Email Service
RESEND_API_KEY="re_xxxxxxxxxxxxx"
EMAIL_FROM="noreply@mannystoolbox.com"

# OPTIONAL - OpenAI
OPENAI_API_KEY="sk-xxxxxxxxxxxxx"
OPENAI_MODEL="gpt-4o-mini"

# OPTIONAL - Daily Notepad
DAILY_NOTEPAD_DEADLINE_HOUR=9
UPLOAD_DIR="uploads/daily-notepad"

# OPTIONAL - Cron Jobs
CRON_SECRET="your-cron-secret-here"

# OPTIONAL - Environment
NODE_ENV="development"
```

---

## 🔧 Quick Setup Commands

### Generate NEXTAUTH_SECRET
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Generate CRON_SECRET
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Check Current Environment Variables
```bash
# Print all env vars (be careful with secrets!)
printenv | grep -E "(DATABASE|NEXTAUTH|RESEND|OPENAI|CRON)"
```

---

## 🌍 Environment-Specific Settings

### Local Development
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/mannys_toolbox?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="local-dev-secret-here"
RESEND_API_KEY="re_test_xxxxxxxxxxxxx"
EMAIL_FROM="onboarding@resend.dev"
NODE_ENV="development"
```

### Production (Railway/Vercel)
```env
DATABASE_URL="postgresql://user:password@db.railway.app:5432/railway?schema=public"
NEXTAUTH_URL="https://mannystoolbox.com"
NEXTAUTH_SECRET="production-secret-here"
RESEND_API_KEY="re_live_xxxxxxxxxxxxx"
EMAIL_FROM="noreply@mannystoolbox.com"
NODE_ENV="production"
```

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] `DATABASE_URL` is set and correct
- [ ] `NEXTAUTH_URL` matches your production domain
- [ ] `NEXTAUTH_SECRET` is unique and secure
- [ ] `RESEND_API_KEY` is valid
- [ ] `EMAIL_FROM` is verified in Resend
- [ ] `OPENAI_API_KEY` is set (if using AI features)
- [ ] `CRON_SECRET` is set (if using cron jobs)
- [ ] All secrets are different from examples
- [ ] `.env` is in `.gitignore` (never commit!)

---

## 🔒 Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore` for a reason
2. **Use strong, unique secrets** - Don't reuse secrets across environments
3. **Rotate secrets regularly** - Especially after team changes
4. **Use different secrets for dev/prod** - Never use production secrets locally
5. **Limit API key permissions** - Only grant necessary permissions
6. **Monitor API usage** - Check for unusual activity
7. **Use environment variables in hosting** - Don't hardcode in code

---

## 🆘 Troubleshooting

### "Connection refused" (Database)
- Check `DATABASE_URL` format
- Verify PostgreSQL is running
- Check username/password

### "Invalid API key" (Resend/OpenAI)
- Verify API key is correct
- Check for extra spaces
- Verify key is active in dashboard

### "Invalid credentials" (NextAuth)
- Check `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your domain
- Clear browser cookies and try again

### Emails not sending
- Verify `RESEND_API_KEY` is correct
- Check `EMAIL_FROM` is verified in Resend
- Check Resend dashboard for errors

---

## 📚 Additional Resources

- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [NextAuth Documentation](https://next-auth.js.org/configuration/options)
- [Resend Documentation](https://resend.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

## 💡 Need Help?

If you're stuck:
1. Check the troubleshooting section above
2. Verify all required variables are set
3. Check server logs for specific error messages
4. Review the variable documentation above
