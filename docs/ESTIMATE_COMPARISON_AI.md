# Estimate Comparison Tool - AI Logic Documentation

## Overview

The AI comparison logic has been enhanced to provide accurate, detailed analysis of construction estimates with intelligent matching and discrepancy detection.

## Key Features

### 1. Enhanced AI Prompting

**System Prompt:**
- Expert construction estimator persona
- Deep knowledge of construction terminology, abbreviations, and formats
- Understanding of Xactimate and Symbility formats
- Cost estimation best practices

**Comparison Prompt:**
- Detailed rules for missing items detection
- Discrepancy thresholds (>25% for measurements, >15% for prices)
- Priority flagging (critical vs minor)
- Structured JSON output format

### 2. Pre-processing Utilities

**File: `lib/estimate-parser.ts`**
- `normalizeItemDescription()` - Normalizes construction terminology
- `calculateItemSimilarity()` - Jaccard similarity for item matching
- `findMatchingItems()` - Identifies similar items with different wording

**File: `lib/estimate-comparison.ts`**
- `preprocessComparison()` - Pre-analyzes estimates before AI
- Code-based matching (Xactimate/Symbility codes)
- Automatic discrepancy detection
- Missing items identification

### 3. Comparison Rules

#### Missing Items
- Items in contractor estimate but NOT in adjuster estimate
- **Critical** if: Total price > $500 OR structural/safety item
- **Minor** otherwise

#### Discrepancies
- **Quantity differences**: Flag if > 25%
- **Price differences**: Flag if > 15%
- **Measurement differences**: Flag if > 25%
- **Critical** if: Total impact > $1000 OR difference > 50%
- **Minor** otherwise

#### Similar Items Matching
- Handles variations in wording:
  - "Remove and replace" = "R&R" = "Demo and install"
  - "Square feet" = "sq ft" = "sqft"
  - "Linear feet" = "lf" = "ln ft"
- Uses >60% similarity threshold

### 4. Response Validation

- JSON extraction with markdown cleanup
- Structure validation
- Automatic summary calculation if missing
- Error handling with helpful messages

### 5. AI Configuration

- **Temperature**: 0.2 (very low for consistency)
- **Max Tokens**: 4000 (allows detailed analysis)
- **Model**: GPT-4 Turbo (via OPENAI_MODEL env var)

## Data Flow

1. **File Upload** → Files stored in database
2. **PDF Parsing** → Extract structured data (TODO: implement)
3. **Pre-processing** → Code matching, initial discrepancy detection
4. **AI Comparison** → Detailed analysis with enhanced prompts
5. **Result Validation** → Structure validation and enhancement
6. **Response** → Structured JSON with missing items, discrepancies, summary

## Output Structure

```json
{
  "missingItems": [
    {
      "item": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "category": "string",
      "priority": "critical" | "minor"
    }
  ],
  "discrepancies": [
    {
      "item": "string",
      "adjusterValue": number | string,
      "contractorValue": number | string,
      "difference": number | string,
      "differencePercent": number,
      "type": "quantity" | "price" | "measurement",
      "priority": "critical" | "minor"
    }
  ],
  "summary": {
    "totalCostDifference": number,
    "missingItemsCount": number,
    "discrepanciesCount": number,
    "criticalIssues": number,
    "minorIssues": number
  }
}
```

## Next Steps

1. **PDF Parsing Implementation** - Extract actual data from PDFs
2. **Xactimate/Symbility Format Support** - Specialized parsers
3. **Fine-tuning** - Adjust thresholds based on real-world testing
4. **Performance Optimization** - Cache common comparisons

## Testing Recommendations

1. Test with real estimate files
2. Verify threshold accuracy (25% for measurements, 15% for prices)
3. Validate priority flagging (critical vs minor)
4. Check similarity matching with various wording
5. Test edge cases (empty estimates, very large files, etc.)
