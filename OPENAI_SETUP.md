# OpenAI Setup Guide - Making AI Work Live

## Current Status

✅ **OpenAI package installed** (`openai` npm package)  
✅ **Model configured** (`gpt-4-turbo-preview`)  
❌ **API Key NOT configured** (needs your actual key)

## Step 1: Get Your OpenAI API Key

1. **Go to OpenAI Platform**: https://platform.openai.com/

2. **Sign in or Create Account**:
   - If you don't have an account, create one at https://platform.openai.com/signup
   - You'll need to add payment method (OpenAI charges per API usage)

3. **Navigate to API Keys**:
   - Click on your profile icon (top right)
   - Select "API keys" or go directly to: https://platform.openai.com/api-keys

4. **Create a New API Key**:
   - Click "Create new secret key"
   - Give it a name (e.g., "MannysToolBox")
   - **Copy the key immediately** - you won't be able to see it again!
   - It will look like: `sk-proj-...` (starts with `sk-`)

## Step 2: Add API Key to Your .env File

Open your `.env` file in the project root and update/add these lines:

```env
OPENAI_API_KEY="sk-proj-your-actual-key-here"
OPENAI_MODEL="gpt-4-turbo-preview"
```

**Important**: 
- Replace `sk-proj-your-actual-key-here` with your actual API key
- Keep the quotes around the key
- Make sure there are no extra spaces

## Step 3: Restart Your Dev Server

After updating the `.env` file:

1. **Stop your dev server** (Ctrl+C in terminal)
2. **Start it again**:
   ```bash
   npm run dev
   ```

3. **Test the API**:
   - Go to `http://localhost:3000/tools/estimate-comparison`
   - Try uploading two PDF files
   - The AI should now process them!

## Step 4: For Production (Railway)

When you deploy to Railway, you need to set environment variables:

### Option A: Railway Dashboard

1. Go to your Railway project dashboard
2. Click on your service (MannysToolBox)
3. Go to the "Variables" tab
4. Click "New Variable"
5. Add these variables:

```
OPENAI_API_KEY = sk-proj-your-actual-key-here
OPENAI_MODEL = gpt-4-turbo-preview
```

6. Save and redeploy

### Option B: Railway CLI

```bash
railway variables set OPENAI_API_KEY=sk-proj-your-actual-key-here
railway variables set OPENAI_MODEL=gpt-4-turbo-preview
```

## Step 5: Verify It's Working

### Test Locally:

1. **Check if API key is loaded**:
   - Look at your terminal when you start the server
   - If you see errors about `OPENAI_API_KEY is not set`, it's not configured correctly

2. **Test the Estimate Comparison Tool**:
   - Upload two PDF estimates
   - The tool should process them using AI
   - You should see comparison results

3. **Check OpenAI Usage**:
   - Go to https://platform.openai.com/usage
   - You should see API calls being made
   - You'll see costs there too

## Pricing Information

OpenAI charges based on:
- **Model used**: GPT-4 Turbo is more expensive than GPT-3.5
- **Tokens used**: Input tokens (text sent) + Output tokens (text received)
- **Current rates** (as of 2024):
  - GPT-4 Turbo: ~$0.01 per 1K input tokens, ~$0.03 per 1K output tokens
  - Estimate comparison might use 5,000-50,000 tokens per comparison depending on PDF size

**Cost Example**:
- Small estimate (10 line items): ~$0.10-0.50 per comparison
- Large estimate (100+ line items): ~$0.50-2.00 per comparison

## Alternative Models (Cheaper Options)

If GPT-4 Turbo is too expensive, you can use cheaper models in your `.env`:

```env
# Cheaper option (but less accurate):
OPENAI_MODEL="gpt-3.5-turbo"

# Most accurate (but more expensive):
OPENAI_MODEL="gpt-4-turbo-preview"

# Latest GPT-4:
OPENAI_MODEL="gpt-4"

# Very fast and cheap (but less accurate):
OPENAI_MODEL="gpt-3.5-turbo-16k"
```

## Troubleshooting

### "OPENAI_API_KEY is not set"
- Make sure `.env` file exists in project root
- Check that the key is in quotes: `OPENAI_API_KEY="sk-..."`
- Restart your dev server after changing `.env`
- Make sure `.env` is not in `.gitignore` (it should be!)

### "Invalid API Key"
- Verify your key starts with `sk-`
- Make sure there are no extra spaces or line breaks
- Try creating a new API key from OpenAI dashboard

### "Rate limit exceeded"
- You've hit OpenAI's rate limits
- Add payment method to increase limits
- Or use a cheaper model to reduce usage

### "Insufficient quota"
- You need to add payment method to OpenAI account
- Go to https://platform.openai.com/account/billing

## Security Notes

⚠️ **NEVER commit your `.env` file to Git!**

- `.env` should be in `.gitignore` (it already is)
- Never share your API key publicly
- Rotate keys if accidentally exposed
- Use different keys for development and production

## Next Steps

Once configured:
1. ✅ API key in `.env` file
2. ✅ Restart dev server
3. ✅ Test the Estimate Comparison Tool
4. ✅ Monitor usage at platform.openai.com/usage
5. ✅ Set up for Railway production

## Need Help?

- OpenAI Docs: https://platform.openai.com/docs
- API Status: https://status.openai.com/
- Support: https://help.openai.com/
