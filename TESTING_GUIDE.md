# Testing Guide - Estimate Comparison Tool

## Quick Start

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Access the Application
Open your browser and go to: `http://localhost:3000`

### 3. Create an Account
- Click "Sign Up" in the navigation
- Enter your name, email, and password
- You'll be redirected to sign in

### 4. Access the Tool

**Option A: Via Main Page**
- On the home page, you'll see "Estimate Comparison Tool" under "Construction" category
- Click on it to access the tool

**Option B: Direct URL**
- Go to: `http://localhost:3000/tools/estimate-comparison`

**Option C: Via Dropdown**
- Click "Select a Tool" dropdown in navigation
- Find "Estimate Comparison Tool" under "Construction"
- Click to access

## Testing Workflow

### Step 1: Upload Files
1. **Adjuster's Estimate**: Upload a PDF, Xactimate, or Symbility file
2. **Contractor's Estimate**: Upload your Xactimate PDF
3. Both files should appear with checkmarks
4. Click "Next: Client Information"

### Step 2: Enter Client Information
1. Enter a **Client Name** (e.g., "John Smith")
2. Enter a **Claim Number** (e.g., "CLAIM12345")
3. Click "Process Comparison"

### Step 3: Processing
- You'll see a loading spinner
- AI is analyzing and comparing the estimates
- This may take 30-60 seconds depending on file size

### Step 4: Review Results
You'll see:
- **Summary Card**: Total cost difference, missing items count, discrepancies, critical issues
- **Missing Items Table**: Items in contractor estimate but not in adjuster estimate
- **Discrepancies Section**: Differences in quantities, prices, or measurements
- **Notes Field**: Add your own comments

### Step 5: Export/Save
- **Save**: Saves the comparison to your "Saved Work" page
- **Export PDF**: Downloads a professional PDF report

## Testing with Sample Data

If you don't have real estimates yet, you can:
1. Create simple PDF files with estimate-like content
2. Test the UI flow (upload, forms, etc.)
3. The AI will attempt to parse and compare (may return empty results with non-estimate PDFs)

## Expected Behavior

### Successful Flow
- Files upload successfully
- Client info form works
- Processing completes
- Results display correctly
- PDF export works
- Save functionality works

### Error Handling
- Invalid files show error messages
- Missing fields prevent progression
- API errors display user-friendly messages

## Troubleshooting

### Tool Not Appearing
- Make sure dev server is running
- Check browser console for errors
- Verify you're signed in

### Upload Fails
- Check file size (should be under 10MB default)
- Verify file format (PDF, XLSX)
- Check browser console for errors

### Processing Fails
- Check server console for errors
- Verify OpenAI API key is set in `.env`
- Check that files were uploaded successfully

### PDF Export Fails
- Check server console for errors
- Verify pdfkit is installed
- Try with smaller comparison results first

## Next Steps After Testing

1. Test with real estimate files
2. Verify AI parsing accuracy
3. Check PDF export quality
4. Test save/load functionality
5. Verify mobile responsiveness

## Support

If you encounter issues:
- Check browser console (F12)
- Check server terminal output
- Verify all environment variables are set
- Ensure database is connected
