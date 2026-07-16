// Provider-agnostic text completion for the estimate engine's AI tasks.
//
// No lock-in: OpenAI, Anthropic (Claude), and Google (Gemini) via plain REST
// (no extra SDKs). A provider is usable when its API key env var is set;
// tasks pick a provider by env config and fall back to whatever is available.
// The engine's verification gates (reconciliation, review queue) referee
// quality, so providers can be swapped or benchmarked freely —
// see scripts/benchmark-ai.ts.
//
// Env:
//   OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY   (keys)
//   AI_EXTRACT_PROVIDER / AI_EXTRACT_MODEL     extraction fallback task
//   AI_SUGGEST_PROVIDER / AI_SUGGEST_MODEL     pairing-suggestion task

export type AIProvider = 'openai' | 'anthropic' | 'google'

export interface CompletionRequest {
  system?: string
  prompt: string
  temperature?: number
  maxTokens?: number
  provider?: AIProvider
  model?: string
}

export interface CompletionResult {
  text: string
  provider: AIProvider
  model: string
  ms: number
  error?: string
}

const KEY_ENVS: Record<AIProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
}

/** Default model per provider and task size. */
const DEFAULT_MODELS: Record<AIProvider, { small: string; large: string }> = {
  openai: { small: 'gpt-4o-mini', large: 'gpt-4o' },
  anthropic: { small: 'claude-haiku-4-5-20251001', large: 'claude-sonnet-5' },
  google: { small: 'gemini-2.5-flash', large: 'gemini-2.5-pro' },
}

/** A real key, not an unpasted placeholder from .env scaffolding. */
function usableKey(value: string | undefined): boolean {
  const key = value?.trim() ?? ''
  return key.length >= 16 && !/paste|your-key|xxxx/i.test(key)
}

export function availableProviders(): AIProvider[] {
  return (Object.keys(KEY_ENVS) as AIProvider[]).filter((p) => usableKey(process.env[KEY_ENVS[p]]))
}

/** Resolve provider+model for a task from env, falling back to any usable provider. */
export function resolveTask(
  task: 'extract' | 'suggest'
): { provider: AIProvider; model: string } | null {
  const prefix = task === 'extract' ? 'AI_EXTRACT' : 'AI_SUGGEST'
  const size = task === 'extract' ? 'large' : 'small'
  const available = availableProviders()
  if (available.length === 0) return null

  const wanted = process.env[`${prefix}_PROVIDER`]?.trim().toLowerCase() as AIProvider | undefined
  const provider = wanted && available.includes(wanted) ? wanted : available[0]
  const model = process.env[`${prefix}_MODEL`]?.trim() || DEFAULT_MODELS[provider][size]
  return { provider, model }
}

export function defaultModel(provider: AIProvider, size: 'small' | 'large'): string {
  return DEFAULT_MODELS[provider][size]
}

export async function completeText(request: CompletionRequest): Promise<CompletionResult> {
  const provider = request.provider ?? availableProviders()[0]
  if (!provider) {
    return { text: '', provider: 'openai', model: '', ms: 0, error: 'No AI provider API key configured' }
  }
  const key = process.env[KEY_ENVS[provider]]?.trim()
  if (!key || !usableKey(key)) {
    return { text: '', provider, model: '', ms: 0, error: `${KEY_ENVS[provider]} not set` }
  }
  const model = request.model ?? DEFAULT_MODELS[provider].small
  const started = Date.now()
  try {
    const text = await CALLERS[provider](key, model, request)
    return { text, provider, model, ms: Date.now() - started }
  } catch (error) {
    return {
      text: '',
      provider,
      model,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

type Caller = (key: string, model: string, request: CompletionRequest) => Promise<string>

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`HTTP ${response.status}: ${detail}`)
  }
  return response.json()
}

const CALLERS: Record<AIProvider, Caller> = {
  openai: async (key, model, request) => {
    const data = (await postJson(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${key}` },
      {
        model,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens ?? 4000,
        messages: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          { role: 'user', content: request.prompt },
        ],
      }
    )) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  },

  anthropic: async (key, model, request) => {
    const data = (await postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      {
        model,
        max_tokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0,
        ...(request.system ? { system: request.system } : {}),
        messages: [{ role: 'user', content: request.prompt }],
      }
    )) as { content?: { type: string; text?: string }[] }
    return (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
  },

  google: async (key, model, request) => {
    const data = (await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {},
      {
        ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0,
          maxOutputTokens: request.maxTokens ?? 4000,
        },
      }
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    return (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('')
  },
}
