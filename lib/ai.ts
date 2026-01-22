// AI integration utilities for OpenAI

import OpenAI from 'openai'

export interface AIRequest {
  prompt: string
  context?: string
  toolId?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface AIResponse {
  result: string
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    let apiKey = process.env.OPENAI_API_KEY
    console.log('[OpenAI] Checking API key...', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      keyPrefix: apiKey?.substring(0, 10) || 'none',
    })
    
    if (!apiKey) {
      console.error('[OpenAI] OPENAI_API_KEY is not set in environment variables')
      throw new Error('OPENAI_API_KEY is not set in environment variables')
    }
    
    // Clean up the key: trim whitespace and remove quotes if present
    apiKey = apiKey.trim()
    if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || 
        (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
      apiKey = apiKey.slice(1, -1).trim()
    }
    
    // Validate key format (should start with sk-)
    if (!apiKey.startsWith('sk-')) {
      const preview = apiKey.length > 10 
        ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 3)}` 
        : '***'
      console.error(`[OpenAI] Invalid OpenAI API key format. Key preview: ${preview}`)
      throw new Error('OPENAI_API_KEY format is invalid. It should start with "sk-"')
    }
    
    console.log('[OpenAI] Initializing OpenAI client with key prefix:', apiKey.substring(0, 10) + '...')
    openai = new OpenAI({ apiKey })
  }
  return openai
}

/**
 * Send a request to OpenAI
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  try {
    let client: OpenAI
    try {
      client = getOpenAI()
    } catch (initError: any) {
      console.error('[OpenAI] Initialization error:', initError.message)
      return {
        result: '',
        error: initError.message || 'Failed to initialize OpenAI client'
      }
    }
    
    const systemPrompt = request.systemPrompt || 
      (request.toolId 
        ? `You are an AI assistant helping users with the ${request.toolId} tool. ${request.context || ''}`
        : `You are a helpful AI assistant. ${request.context || ''}`
      )

    console.log('[OpenAI] Making API call...', {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      promptLength: request.prompt.length,
      systemPromptLength: systemPrompt.length,
      maxTokens: request.maxTokens ?? 2000,
    })

    const startTime = Date.now()
    
    // Wrap API call with timeout (3 minutes)
    const completion = await Promise.race([
      client.chat.completions.create({
        // Default to cheaper model, but can be overridden via OPENAI_MODEL env var
        // Options: 'gpt-4o-mini' (cheapest, recommended), 'gpt-3.5-turbo' (very cheap), 'gpt-4-turbo' (most accurate but expensive)
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.prompt }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2000, // Increased for detailed comparisons
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API call timed out after 3 minutes')), 3 * 60 * 1000)
      )
    ]) as any
    
      const apiTime = Date.now() - startTime
      const tokensUsed = completion.usage?.total_tokens || 0
      console.log('[OpenAI] API call completed:', {
        time: `${apiTime}ms`,
        tokens: tokensUsed,
      })

    const result = completion.choices[0]?.message?.content || 'No response from AI'

    return {
      result,
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined
    }
  } catch (error: any) {
    console.error('[OpenAI] API error:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
    })
    
    // Check if it's an authentication error
    if (error.status === 401 || error.code === 'invalid_api_key' || 
        error.message?.toLowerCase().includes('incorrect api key') ||
        error.message?.toLowerCase().includes('invalid_api_key')) {
      return {
        result: '',
        error: 'OpenAI API key is invalid or incorrect. Please check your OPENAI_API_KEY environment variable.'
      }
    }
    
    return {
      result: '',
      error: error.message || 'Failed to get AI response'
    }
  }
}
