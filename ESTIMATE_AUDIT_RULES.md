# Estimate Completeness Audit - What It Checks

## Overview

The Estimate Completeness Audit tool analyzes construction estimates to identify **missing line items** that should accompany other items. It uses a combination of:

1. **Heuristic Rules** (Code-based checks)
2. **AI Analysis** (Expert knowledge from OpenAI)

---

## Current Rules Being Checked

### Primary Focus: Drywall Replacement Dependencies

The tool specifically checks for drywall-related work and ensures all required companion items are included.

#### Rule 1: Drywall Replacement → Tape & Mud (CRITICAL)
**What it checks:**
- If estimate contains: `drywall`/`sheetrock` + `replace`/`replacement`/`remove`/`demo`/`install`/`hang`
- Then it MUST have: `tape`/`mud`/`compound`/`joint` (joint compound)

**If missing:**
- **Required Item:** "Drywall tape and mud (finish)"
- **Reason:** "Drywall replacement typically requires taping and joint compound."
- **Priority:** **CRITICAL**

---

#### Rule 2: Drywall Replacement → Texture (CRITICAL)
**What it checks:**
- If estimate contains: Drywall replacement (see above)
- Then it MUST have: `texture`/`orange peel`/`knockdown` (texture finish)

**If missing:**
- **Required Item:** "Drywall texture (match existing)"
- **Reason:** "Drywall replacement usually requires re-texturing to match existing finish."
- **Priority:** **CRITICAL**

---

#### Rule 3: Drywall Replacement → Prime/Seal (MINOR)
**What it checks:**
- If estimate contains: Drywall replacement
- Then it SHOULD have: `prime`/`primer`/`seal` (primer/sealer)

**If missing:**
- **Required Item:** "Prime/seal new drywall"
- **Reason:** "New drywall needs primer/sealer before paint."
- **Priority:** **MINOR**

---

#### Rule 4: Drywall Replacement → Paint Repaired Surfaces (CRITICAL)
**What it checks:**
- If estimate contains: Drywall replacement
- Then it MUST have: `paint`/`finish coat` (paint on repaired surfaces)

**If missing:**
- **Required Item:** "Paint repaired surfaces"
- **Reason:** "Drywall replacement usually requires painting finished surfaces."
- **Priority:** **CRITICAL**

---

#### Rule 5: Drywall Replacement → Full Room Paint (MINOR)
**What it checks:**
- If estimate contains: Drywall replacement
- Then it SHOULD have: `paint room`/`paint walls`/`paint ceiling`/`paint entire` (full room paint)

**If missing:**
- **Required Item:** "Paint entire affected room (walls/ceiling)"
- **Reason:** "Patching drywall often requires full room paint for color/texture consistency."
- **Priority:** **MINOR**

---

## How It Works

### Step 1: Heuristic Checks (Rule-Based)
1. Extracts all line items from the estimate
2. Normalizes item descriptions (lowercase, standardized terms)
3. Checks for drywall replacement keywords
4. Checks if required companion items exist
5. Creates a list of missing items based on rules

### Step 2: AI Analysis (Expert Knowledge)
1. Sends all line items + heuristic findings to AI
2. AI analyzes using construction industry knowledge:
   - Xactimate line item codes and descriptions
   - Drywall, texture, paint sequencing
   - Scope dependencies (e.g., prep + finish + paint)
   - Construction terminology and abbreviations
3. AI can identify additional missing items beyond the rules
4. AI validates whether heuristic findings are correct
5. Returns comprehensive audit results

### Step 3: Results Summary
The tool returns:
- **Checked Rules:** Number of rule checks performed (currently 2 main rules)
- **Missing Items:** Total count of missing line items found
- **Critical:** Count of CRITICAL priority missing items
- **Minor:** Count of MINOR priority missing items
- **Detailed List:** Each missing item with:
  - Required item name
  - Reason why it's needed
  - Priority (critical/minor)
  - Related items found in estimate
  - Room/location (if applicable)

---

## Priority Levels

### CRITICAL
Items that **must** be included for the work to be complete and acceptable. Without these, the estimate is incomplete.

Examples:
- Tape & mud for drywall
- Texture for drywall
- Paint for repaired surfaces

### MINOR
Items that are **recommended** but may be optional depending on the scope. These improve quality but may not be strictly required.

Examples:
- Prime/seal before paint
- Full room paint (vs. just spot paint)

---

## What Keywords Trigger Checks

### Drywall Replacement Detection
The tool looks for these combinations:
- **Drywall terms:** `drywall`, `sheetrock`
- **Action terms:** `replace`, `replacement`, `remove`, `demo`, `install`, `hang`

**Example triggers:**
- "Drywall replacement"
- "Replace sheetrock"
- "Remove and install drywall"
- "Demo drywall"

### Required Companion Items Detection

**Tape & Mud:**
- `tape`, `mud`, `compound`, `joint`

**Texture:**
- `texture`, `orange peel`, `knockdown`

**Prime/Seal:**
- `prime`, `primer`, `seal`

**Paint:**
- `paint`, `finish coat`

**Full Room Paint:**
- `paint room`, `paint walls`, `paint ceiling`, `paint entire`

---

## Comprehensive Coverage

The tool now checks for dependencies across **ALL major construction trades**, including:

### ✅ Currently Implemented Categories:
- **Drywall & Interior Finishes** (5 rules)
- **Roofing** (4 rules)
- **Plumbing** (5 rules)
- **Electrical** (4 rules)
- **HVAC** (3 rules)
- **Flooring** (3 rules)
- **Windows & Doors** (4 rules)
- **Siding & Exterior** (2 rules)
- **Water Damage Restoration** (2 rules)
- **Foundation & Structural** (to be expanded)

**Total: 30+ dependency rules across all trades**

### 📚 Documentation
- See `docs/ESTIMATE_DEPENDENCIES_COMPREHENSIVE.md` for complete rule reference
- See `lib/estimate-dependencies.ts` for implementation

---

## Example: What Gets Flagged

### Example Estimate
```
Line Item 1: Remove and replace drywall - 50 sq ft
Line Item 2: Apply orange peel texture - 50 sq ft
Line Item 3: Prime walls - 50 sq ft
Line Item 4: Paint walls - 50 sq ft
```

### Result
✅ **No missing items** - All required items are present:
- ✓ Drywall replacement detected
- ✓ Tape & mud (implied in "replace")
- ✓ Texture found
- ✓ Prime found
- ✓ Paint found

---

### Example Estimate (Missing Items)
```
Line Item 1: Remove and replace drywall - 50 sq ft
Line Item 2: Paint walls - 50 sq ft
```

### Result
❌ **Missing Items Detected:**
1. **CRITICAL:** "Drywall tape and mud (finish)" - Missing tape/mud
2. **CRITICAL:** "Drywall texture (match existing)" - Missing texture
3. **MINOR:** "Prime/seal new drywall" - Missing primer
4. **MINOR:** "Paint entire affected room (walls/ceiling)" - Only spot paint, not full room

---

## Summary

The tool is looking for **construction dependencies** - items that must accompany each other to complete the work properly. Currently focused on drywall work, but the AI can identify other dependencies based on industry knowledge.

**Key Point:** The tool is **conservative** - it only flags items that are truly missing. If an item exists or is clearly covered (even with different wording), it won't be flagged.
