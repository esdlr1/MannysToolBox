# PDF Parsing Implementation

## Overview

The PDF parsing system extracts structured data from construction estimate PDFs using a combination of text extraction and AI-powered parsing.

## Architecture

### 1. Text Extraction
- **Library**: `pdf-parse`
- Extracts raw text from PDF files
- Handles both text-based and image-based PDFs (basic OCR support)

### 2. Format Detection
Automatically detects estimate format:
- **Xactimate**: Detects "xactimate" or "xact" in text
- **Symbility**: Detects "symbility" or "sym" in text
- **PDF**: Standard construction estimate format
- **Unknown**: Falls back to generic parsing

### 3. AI-Powered Parsing
Uses OpenAI to parse unstructured text into structured data:
- Line items with quantities, prices, units
- Measurements (area, linear, volume, count)
- Total costs and subtotals
- Metadata (date, project name)

## Data Flow

```
PDF File → Extract Text → Detect Format → AI Parsing → Structured Data
```

## Extracted Data Structure

```typescript
{
  lineItems: [
    {
      item: string,
      description: string,
      quantity: number,
      unit: string,
      unitPrice: number,
      totalPrice: number,
      category?: string,
      code?: string // Xactimate/Symbility code
    }
  ],
  measurements: [
    {
      type: "area" | "linear" | "volume" | "count",
      description: string,
      value: number,
      unit: string,
      location?: string
    }
  ],
  totalCost: number,
  subtotals: { [category: string]: number },
  metadata: {
    format: "xactimate" | "symbility" | "pdf" | "unknown",
    date?: string,
    projectName?: string
  }
}
```

## Features

### Text Extraction
- Handles text-based PDFs
- Basic support for image-based PDFs (if text layer exists)
- Error handling for corrupted or empty PDFs

### Format Detection
- Automatic format recognition
- Format-specific parsing hints for AI
- Fallback to generic parsing

### AI Parsing
- Understands construction terminology
- Extracts line items accurately
- Handles various estimate formats
- Validates and normalizes data

### Large File Handling
- Truncates very long PDFs (keeps first and last parts)
- Maintains context for AI parsing
- Max length: ~15,000 characters

## Usage

```typescript
import { parseEstimatePDF } from '@/lib/pdf-parser'

const parsedData = await parseEstimatePDF('/path/to/estimate.pdf')
```

## Error Handling

- Empty PDFs: Returns error message
- Image-only PDFs: May require OCR (future enhancement)
- Parsing failures: Returns structured error with details
- AI failures: Falls back gracefully with error message

## Limitations

1. **Image-based PDFs**: Currently relies on text extraction. May need OCR for scanned PDFs
2. **Complex layouts**: Very complex table layouts may require additional parsing
3. **File size**: Very large PDFs are truncated for AI processing
4. **Format variations**: Different estimate software versions may vary

## Future Enhancements

1. **OCR Integration**: For image-based/scanned PDFs
2. **Table Detection**: Better handling of tabular data
3. **Format-Specific Parsers**: Dedicated parsers for Xactimate/Symbility
4. **Caching**: Cache parsed results for repeated comparisons
5. **Batch Processing**: Process multiple estimates at once

## Dependencies

- `pdf-parse`: PDF text extraction
- `openai`: AI-powered parsing
- `fs/promises`: File system operations

## Installation

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```
