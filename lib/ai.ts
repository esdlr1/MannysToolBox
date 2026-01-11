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
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables')
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

/**
 * Send a request to OpenAI
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  try {
    const client = getOpenAI()
    
    const systemPrompt = request.systemPrompt || 
      (request.toolId 
        ? `You are an AI assistant helping users with the ${request.toolId} tool. ${request.context || ''}`
        : `You are a helpful AI assistant. ${request.context || ''}`
      )

    const completion = await client.chat.completions.create({
      // Default to cheaper model, but can be overridden via OPENAI_MODEL env var
      // Options: 'gpt-4o-mini' (cheapest, recommended), 'gpt-3.5-turbo' (very cheap), 'gpt-4-turbo' (most accurate but expensive)
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000, // Increased for detailed comparisons
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
    console.error('OpenAI API error:', error)
    return {
      result: '',
      error: error.message || 'Failed to get AI response'
    }
  }
}
