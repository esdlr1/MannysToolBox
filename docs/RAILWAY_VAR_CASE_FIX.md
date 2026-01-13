# Fix: Environment Variable Case Sensitivity

## ⚠️ Issue Found

Your Railway variable is named:
- `resend_api_key` (lowercase)

But the code expects:
- `RESEND_API_KEY` (uppercase)

**Environment variables are case-sensitive in Node.js/Next.js!**

---

## ✅ Solution: Rename the Variable

### Option 1: Rename in Railway (Recommended)

1. In Railway Variables tab, find `resend_api_key`
2. Click the three dots (`⋮`) on the right
3. Click "Delete" or "Remove"
4. Click "+ New Variable"
5. Add:
   - **Name:** `RESEND_API_KEY` (uppercase)
   - **Value:** `re_7QunwNfu_KVVqqcdydAbwYMn2MjSrgAce`
6. Save

### Option 2: Keep Both (Temporary)

You can keep both variables temporarily, but the code will only use `RESEND_API_KEY`.

---

## 📋 Current Status

✅ **All Required Variables:**
- `DATABASE_URL` ✅
- `EMAIL_FROM` ✅ (noreply@mannystoolbox.com)
- `NEXTAUTH_SECRET` ✅
- `NEXTAUTH_URL` ✅
- `NODE_ENV` ✅
- `OPENAI_API_KEY` ✅
- `OPENAI_MODEL` ✅
- `resend_api_key` ⚠️ (needs to be `RESEND_API_KEY`)

---

## 🔧 Quick Fix Steps

1. **Delete** `resend_api_key` (lowercase)
2. **Add** `RESEND_API_KEY` (uppercase) with same value
3. **Wait** for Railway to redeploy
4. **Test** email sending

---

## ✅ After Fix

Once renamed to `RESEND_API_KEY`:
- ✅ Daily Notepad emails will work
- ✅ Employee confirmation emails will send
- ✅ Manager notification emails will send
- ✅ Reminder emails will work

---

## 🧪 Testing

After fixing:
1. Wait for Railway redeploy (1-2 minutes)
2. Submit a Daily Notepad as an employee
3. Check email inbox for confirmation
4. Check Railway logs for any errors

---

## 📝 Standard Naming Convention

Environment variables are typically:
- **UPPERCASE** with underscores
- Examples: `DATABASE_URL`, `NEXTAUTH_SECRET`, `RESEND_API_KEY`

This matches what the code expects!
