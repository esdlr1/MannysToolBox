# Railway Environment Variables Checklist

## ✅ Currently Set (6 variables)

1. ✅ `DATABASE_URL` - PostgreSQL connection
2. ✅ `NEXTAUTH_SECRET` - Session encryption
3. ✅ `NEXTAUTH_URL` - App URL (https://mannystoolbox.com)
4. ✅ `NODE_ENV` - Production mode
5. ✅ `OPENAI_API_KEY` - AI features
6. ✅ `OPENAI_MODEL` - gpt-4o-mini

---

## ❌ Missing (Required for Daily Notepad Tool)

### 1. `RESEND_API_KEY` ⚠️ REQUIRED
**Status**: Missing  
**Why**: Required for sending emails (Daily Notepad tool)

**How to add:**
1. Go to https://resend.com
2. Sign up/login
3. Go to API Keys section
4. Create new API key
5. Copy the key (starts with `re_`)
6. In Railway: Click "+ New Variable"
7. Name: `RESEND_API_KEY`
8. Value: `re_xxxxxxxxxxxxx`

---

### 2. `EMAIL_FROM` ⚠️ REQUIRED
**Status**: Missing  
**Why**: Required for email "from" address (Daily Notepad tool)

**How to add:**
1. In Railway: Click "+ New Variable"
2. Name: `EMAIL_FROM`
3. Value: `noreply@mannystoolbox.com` (or your verified domain)

**Important:**
- Must be verified in Resend dashboard
- For testing: use `onboarding@resend.dev`
- For production: verify your domain in Resend first

---

## 🔵 Optional (Recommended)

### 3. `CRON_SECRET` (Recommended)
**Status**: Missing  
**Why**: Secures cron job endpoints (Daily Notepad reminders)

**How to add:**
1. Generate secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. In Railway: Click "+ New Variable"
3. Name: `CRON_SECRET`
4. Value: (paste generated secret)

**Note:** Only needed if you're setting up cron jobs for Daily Notepad reminders.

---

### 4. `DAILY_NOTEPAD_DEADLINE_HOUR` (Optional)
**Status**: Missing (has default: 9)  
**Why**: Customize submission deadline

**How to add (if you want to change from 9 AM):**
1. In Railway: Click "+ New Variable"
2. Name: `DAILY_NOTEPAD_DEADLINE_HOUR`
3. Value: `9` (or your preferred hour, 0-23)

**Default:** 9 (9 AM) - only add if you want a different time.

---

### 5. `UPLOAD_DIR` (Optional)
**Status**: Missing (has default)  
**Why**: Customize upload directory

**Default:** `uploads/daily-notepad`  
**Only add if you need a custom path.**

---

## 📋 Quick Add Guide

### Step 1: Add RESEND_API_KEY
1. Get API key from https://resend.com
2. In Railway Variables tab, click "+ New Variable"
3. Name: `RESEND_API_KEY`
4. Value: `re_xxxxxxxxxxxxx`
5. Click "Add"

### Step 2: Add EMAIL_FROM
1. In Railway Variables tab, click "+ New Variable"
2. Name: `EMAIL_FROM`
3. Value: `noreply@mannystoolbox.com` (or verify your domain first)
4. Click "Add"

### Step 3: Verify Email Domain (Production)
1. Go to Resend dashboard
2. Go to Domains section
3. Add your domain: `mannystoolbox.com`
4. Add DNS records as instructed
5. Wait for verification
6. Use verified email in `EMAIL_FROM`

---

## ✅ Complete Setup Checklist

After adding variables, verify:

- [ ] `RESEND_API_KEY` is set
- [ ] `EMAIL_FROM` is set
- [ ] `EMAIL_FROM` domain is verified in Resend (for production)
- [ ] `CRON_SECRET` is set (if using cron jobs)
- [ ] All variables are saved
- [ ] Service redeploys automatically

---

## 🧪 Testing

After adding variables:

1. **Test Email Sending:**
   - Submit a Daily Notepad as an employee
   - Check if confirmation email is received
   - Check if manager notification is sent

2. **Check Logs:**
   - Go to Railway → Logs tab
   - Look for any email-related errors
   - Verify no "RESEND_API_KEY not set" errors

---

## 🆘 Troubleshooting

### "Email not sending"
- Verify `RESEND_API_KEY` is correct
- Check `EMAIL_FROM` is verified in Resend
- Check Railway logs for errors

### "Invalid API key"
- Verify key starts with `re_`
- Check for extra spaces
- Regenerate key in Resend if needed

### "Domain not verified"
- Go to Resend → Domains
- Add DNS records as shown
- Wait for verification (can take a few minutes)

---

## 📝 Summary

**Must Add:**
- `RESEND_API_KEY` ⚠️
- `EMAIL_FROM` ⚠️

**Should Add:**
- `CRON_SECRET` (if using cron jobs)

**Optional:**
- `DAILY_NOTEPAD_DEADLINE_HOUR` (only if not 9 AM)
- `UPLOAD_DIR` (only if custom path needed)
