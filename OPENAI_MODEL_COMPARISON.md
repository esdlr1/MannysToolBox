# OpenAI Model Comparison & Pricing Guide

## Recommended: GPT-4o-mini (Best Balance)

**Model**: `gpt-4o-mini`  
**Cost**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens  
**Accuracy**: Very good (newest GPT-4 variant, optimized for efficiency)  
**Speed**: Fast  
**Recommended for**: Estimate comparison (good balance of cost and accuracy)

**Example Cost**:
- Small estimate (10 items, ~5K tokens): **~$0.003 per comparison**
- Medium estimate (50 items, ~20K tokens): **~$0.01 per comparison**
- Large estimate (100+ items, ~50K tokens): **~$0.03 per comparison**

---

## Cheapest Option: GPT-3.5 Turbo

**Model**: `gpt-3.5-turbo`  
**Cost**: ~$0.50 per 1M input tokens, ~$1.50 per 1M output tokens  
**Accuracy**: Good (may miss some nuances in construction terminology)  
**Speed**: Very fast  
**Use when**: Budget is primary concern, simpler comparisons

**Example Cost**:
- Small estimate: **~$0.001 per comparison**
- Medium estimate: **~$0.004 per comparison**
- Large estimate: **~$0.01 per comparison**

**Note**: GPT-3.5 may be slightly less accurate with complex construction terminology matching.

---

## Most Accurate: GPT-4 Turbo

**Model**: `gpt-4-turbo-preview` or `gpt-4-turbo`  
**Cost**: ~$10 per 1M input tokens, ~$30 per 1M output tokens  
**Accuracy**: Excellent (best at understanding context and terminology)  
**Speed**: Slower  
**Use when**: Accuracy is critical, dealing with very complex estimates

**Example Cost**:
- Small estimate: **~$0.05 per comparison**
- Medium estimate: **~$0.20 per comparison**
- Large estimate: **~$0.50 per comparison**

**Note**: 20-30x more expensive than GPT-4o-mini!

---

## Cost Comparison Table

| Model | Input Cost | Output Cost | Small Est. | Large Est. | Accuracy |
|-------|-----------|-------------|------------|------------|----------|
| **GPT-4o-mini** ⭐ | $0.15/1M | $0.60/1M | **$0.003** | **$0.03** | Very Good |
| GPT-3.5 Turbo | $0.50/1M | $1.50/1M | **$0.001** | **$0.01** | Good |
| GPT-4 Turbo | $10/1M | $30/1M | **$0.05** | **$0.50** | Excellent |

## Recommendation for Estimate Comparison

**Use `gpt-4o-mini`** - It's:
- ✅ 95% cheaper than GPT-4 Turbo
- ✅ Still uses GPT-4 technology (just optimized)
- ✅ Very accurate for structured tasks like comparison
- ✅ Fast response times
- ✅ Perfect for production use

Since we're doing preprocessing and providing structured prompts, `gpt-4o-mini` should handle the task excellently!

---

## How to Change the Model

### Option 1: Update .env File (Recommended)

```env
# Cheapest, still very accurate (RECOMMENDED)
OPENAI_MODEL="gpt-4o-mini"

# Very cheap, good for simple comparisons
OPENAI_MODEL="gpt-3.5-turbo"

# Most accurate, but expensive
OPENAI_MODEL="gpt-4-turbo"
```

### Option 2: Change Default in Code

The default is now set to `gpt-4o-mini` in `lib/ai.ts`, but you can override it with the `.env` file.

---

## Real-World Cost Examples

### Scenario 1: Small Contractor (50 comparisons/month)
- Using GPT-4o-mini: **~$0.50/month**
- Using GPT-4 Turbo: **~$10/month**

### Scenario 2: Medium Business (500 comparisons/month)
- Using GPT-4o-mini: **~$5/month**
- Using GPT-4 Turbo: **~$100/month**

### Scenario 3: Large Business (5,000 comparisons/month)
- Using GPT-4o-mini: **~$50/month**
- Using GPT-4 Turbo: **~$1,000/month**

---

## Testing Different Models

You can test which model works best for your use case:

1. Start with `gpt-4o-mini` (recommended default)
2. Test with a few real estimates
3. If accuracy is insufficient, try `gpt-4-turbo` for comparison
4. Check costs in OpenAI dashboard: https://platform.openai.com/usage

---

## Why GPT-4o-mini Works Well for This Task

1. **Structured Input**: We provide well-structured JSON data
2. **Preprocessing**: We do smart matching before AI processing
3. **Clear Prompts**: We give very specific instructions
4. **Template Output**: We expect structured JSON responses

All of this helps cheaper models perform well!

---

## Updated Default

I've updated the default model to `gpt-4o-mini` in the code. Just make sure your `.env` file uses:

```env
OPENAI_MODEL="gpt-4o-mini"
```

This gives you the best balance of cost and accuracy for estimate comparison!
