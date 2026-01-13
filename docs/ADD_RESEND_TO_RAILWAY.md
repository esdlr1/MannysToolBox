# Adding Resend API Key to Railway

## ✅ Your Resend API Key

**API Key:** `re_7QunwNfu_KVVqqcdydAbwYMn2MjSrgAce`

---

## 📋 Steps to Add to Railway

### Step 1: Add RESEND_API_KEY

1. Go to your Railway dashboard
2. Select your **MannysToolBox** service
3. Click on the **Variables** tab
4. Click **"+ New Variable"** button
5. Enter:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_7QunwNfu_KVVqqcdydAbwYMn2MjSrgAce`
6. Click **"Add"** or **"Save"**

---

### Step 2: Add EMAIL_FROM

1. Still in the **Variables** tab
2. Click **"+ New Variable"** again
3. Enter:
   - **Name:** `EMAIL_FROM`
   - **Value:** `onboarding@resend.dev` (for testing)
   
   **OR for production:**
   - **Value:** `noreply@mannystoolbox.com` (after verifying domain)
4. Click **"Add"** or **"Save"**

---

## 🧪 Testing Email (Optional)

You can test if emails work by:

1. **Using the Resend dashboard:**
   - Click "Send email" button on the Resend page
   - This will send a test email to `enmaeladio@gmail.com`

2. **Testing in your app:**
   - After adding variables to Railway, the service will redeploy
   - Try submitting a Daily Notepad as an employee
   - Check if confirmation email is received

---

## 📧 Email Domain Setup (Production)

### For Testing (Now):
- Use: `onboarding@resend.dev`
- This works immediately, no setup needed
- Good for development/testing

### For Production (Later):
1. **Verify your domain in Resend:**
   - Go to Resend dashboard → Domains
   - Click "Add Domain"
   - Enter: `mannystoolbox.com`
   - Add the DNS records shown (in your domain registrar)
   - Wait for verification

2. **Update EMAIL_FROM in Railway:**
   - Change from `onboarding@resend.dev`
   - To: `noreply@mannystoolbox.com` (or your verified email)

---

## ✅ Verification Checklist

After adding variables:

- [ ] `RESEND_API_KEY` is added in Railway
- [ ] `EMAIL_FROM` is added in Railway
- [ ] Service redeploys automatically
- [ ] No errors in Railway logs
- [ ] Test email works (optional)

---

## 🎯 Quick Copy-Paste

**For Railway Variables:**

**Variable 1:**
```
Name: RESEND_API_KEY
Value: re_7QunwNfu_KVVqqcdydAbwYMn2MjSrgAce
```

**Variable 2:**
```
Name: EMAIL_FROM
Value: onboarding@resend.dev
```

---

## 🆘 Troubleshooting

### "Invalid API key" error
- Double-check the key is copied correctly
- No extra spaces before/after
- Key should start with `re_`

### Emails not sending
- Check Railway logs for errors
- Verify both variables are set
- Make sure service redeployed after adding variables

### Domain verification issues
- DNS records can take up to 48 hours to propagate
- Check DNS records are added correctly
- Use `onboarding@resend.dev` for testing in the meantime

---

## 📝 Next Steps

1. ✅ Add `RESEND_API_KEY` to Railway
2. ✅ Add `EMAIL_FROM` to Railway
3. 🧪 Test email sending (optional)
4. 📧 Verify domain for production (later)
5. 🚀 Daily Notepad tool emails will now work!
