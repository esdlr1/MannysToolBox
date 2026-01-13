# Quick Environment Variables Setup

## 📋 All Required Variables

### 🔴 Required (Must Have)

1. **DATABASE_URL**
   ```
   postgresql://postgres:YOUR_PASSWORD@localhost:5432/mannys_toolbox?schema=public
   ```
   - Get from pgAdmin4 → Right-click server → Properties
   - Format: `postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=public`

2. **NEXTAUTH_URL**
   ```
   http://localhost:3000
   ```
   - Local: `http://localhost:3000`
   - Production: `https://yourdomain.com`

3. **NEXTAUTH_SECRET**
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   - Generate a random secret using the command above
   - Copy the output to your .env file

4. **RESEND_API_KEY**
   ```
   re_xxxxxxxxxxxxx
   ```
   - Get from: https://resend.com
   - Sign up → API Keys → Create new key

5. **EMAIL_FROM**
   ```
   noreply@mannystoolbox.com
   ```
   - Must be verified in Resend dashboard
   - For testing: use `onboarding@resend.dev`

---

## 🟡 Optional (Can Configure Later)

6. **OPENAI_API_KEY** (only for AI features)
   ```
   sk-xxxxxxxxxxxxx
   ```
   - Get from: https://platform.openai.com/api-keys
   - Only needed for Estimate Comparison Tool

7. **OPENAI_MODEL**
   ```
   gpt-4o-mini
   ```
   - Default: `gpt-4o-mini` (cheapest, fastest)

8. **DAILY_NOTEPAD_DEADLINE_HOUR**
   ```
   9
   ```
   - Default: `9` (9 AM)

9. **UPLOAD_DIR**
   ```
   uploads/daily-notepad
   ```
   - Default: `uploads/daily-notepad`

10. **CRON_SECRET** (for scheduled jobs)
    ```
    your-random-secret-here
    ```
    - Optional but recommended for production
    - Generate with same command as NEXTAUTH_SECRET

11. **NODE_ENV**
    ```
    development
    ```
    - Default: `development`

---

## 🚀 Quick Setup Steps

1. **Create .env file** (copy from .env.example):
   ```bash
   cp .env.example .env
   ```

2. **Generate secrets:**
   ```powershell
   # NEXTAUTH_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   
   # CRON_SECRET (if needed)
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. **Fill in your values** in `.env`:
   - Database connection string
   - NextAuth secret (from step 2)
   - Resend API key
   - Email from address
   - OpenAI API key (optional)

4. **Verify:**
   ```bash
   npm run db:push
   ```

---

## 📝 Complete .env Template

```env
# Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mannys_toolbox?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-generated-secret-here"

# Email Service
RESEND_API_KEY="re_xxxxxxxxxxxxx"
EMAIL_FROM="noreply@mannystoolbox.com"

# OpenAI (Optional)
OPENAI_API_KEY="sk-xxxxxxxxxxxxx"
OPENAI_MODEL="gpt-4o-mini"

# Daily Notepad (Optional)
DAILY_NOTEPAD_DEADLINE_HOUR=9
UPLOAD_DIR="uploads/daily-notepad"

# Cron Jobs (Optional)
CRON_SECRET="your-cron-secret-here"

# Environment
NODE_ENV="development"
```

---

## ✅ Verification

After setting up, verify:
- [ ] Database connects: `npm run db:push`
- [ ] Server starts: `npm run dev`
- [ ] Can log in
- [ ] Emails send (if using Daily Notepad)

---

## 📚 More Details

See `docs/ENVIRONMENT_VARIABLES.md` for complete documentation.
