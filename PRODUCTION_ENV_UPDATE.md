# Production Environment Update Guide

## Railway Environment Variables Update

### Step 1: Update OPENAI_API_KEY in Railway

1. **Go to Railway Dashboard**
   - Navigate to: https://railway.app/project/your-project-id/variables
   - Or: Railway Dashboard → Your Project → MannysToolBox Service → Variables Tab

2. **Find OPENAI_API_KEY variable**
   - Look for `OPENAI_API_KEY` in the variable list
   - Click the **three dots (⋯)** on the right side → **Edit**

3. **Update the API Key**
   - **IMPORTANT**: The entire key must be on **ONE SINGLE LINE** with no line breaks
   - Get your full OpenAI API key from: https://platform.openai.com/account/api-keys
   - Or copy it from your local `.env` file (it starts with `sk-proj-` and is ~165 characters)
   - The full key should be approximately 165 characters long
   - Paste it into the value field in Railway (make sure there are no spaces or line breaks)
   - Click **Save**

4. **Verify the key length**
   - After saving, check that the key shows ~165 characters (not 28)
   - Railway should show the full key (you can use the "eye" icon to reveal it)

### Step 2: Verify All Required Environment Variables

Make sure these variables are set in Railway:

- ✅ `OPENAI_API_KEY` - Your full OpenAI API key (165 characters)
- ✅ `OPENAI_MODEL` - `gpt-4o-mini` (or your preferred model)
- ✅ `DATABASE_URL` - Your PostgreSQL connection string
- ✅ `NEXTAUTH_SECRET` - Your NextAuth secret
- ✅ `NEXTAUTH_URL` - Your production URL (e.g., `https://mannystoolbox.com`)
- ✅ `EMAIL_FROM` - Your email address for notifications
- ✅ `RESEND_API_KEY` - Your Resend API key (if using email)

### Step 3: Trigger a Redeploy

After updating the environment variables, Railway needs to restart the service:

**Option A: Manual Restart**
1. Go to Railway Dashboard → Your Project → MannysToolBox Service
2. Click the **three dots (⋯)** on the service
3. Select **Restart**

**Option B: Trigger via Git Push (Recommended)**
1. Commit any changes:
   ```bash
   git add .
   git commit -m "Update environment variables documentation"
   git push
   ```
2. Railway will automatically redeploy with the new environment variables

**Option C: Force Redeploy**
1. Go to Railway Dashboard → Your Project → MannysToolBox Service → Deployments
2. Click **Deploy** or **Redeploy** on the latest deployment

### Step 4: Verify the Fix

1. **Wait for deployment to complete** (usually 2-5 minutes)
2. **Test the Estimate Audit tool**:
   - Go to: https://mannystoolbox.com/tools/estimate-audit
   - Upload a PDF estimate
   - Click "Analyze Estimate"
   - It should work without the "API key missing or invalid" error

3. **Check Railway logs**:
   - Railway Dashboard → MannysToolBox Service → Deployments → Latest → Logs
   - Look for: `[Estimate Audit] API Key check: { hasKey: true, keyLength: 165, ... }`
   - Should NOT show `keyLength: 28`

### Troubleshooting

**If still getting errors:**

1. **Verify the key is on one line**:
   - Edit the variable again in Railway
   - Make sure there are NO line breaks
   - Get the full key from your OpenAI account or local `.env` file
   - Ensure the full key (~165 characters) is pasted as one continuous line

2. **Clear Railway cache**:
   - Railway might cache environment variables
   - Try doing a full redeploy (Option C above)

3. **Check Railway logs**:
   - Look for error messages about the API key
   - Check if the key length is correct (should be 165, not 28)

4. **Verify the key is valid**:
   - Check your OpenAI account: https://platform.openai.com/account/api-keys
   - Make sure the key is active and has credits

## Quick Checklist

- [ ] Updated `OPENAI_API_KEY` in Railway (full 165-character key, one line)
- [ ] Verified all other required environment variables are set
- [ ] Triggered a restart/redeploy in Railway
- [ ] Waited for deployment to complete
- [ ] Tested the Estimate Audit tool on production
- [ ] Verified logs show correct key length (165 characters)
