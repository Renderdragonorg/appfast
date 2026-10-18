import { AppFastError } from '../../errors.js'
import type { Reasoner, ReasonRequest } from '../types.js'

export interface OpenAiReasonerOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  /** Injectable for tests. Defaults to global fetch. */
  fetch?: typeof fetch
}

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: unknown } }>
}

/**
 * A reasoner backed by OpenAI's chat completions API. Reads `OPENAI_API_KEY`
 * from the environment when no key is passed. Never logs the key.
 */
export function createOpenAiReasoner(options: OpenAiReasonerOptions = {}): Reasoner {
  const model = options.model ?? 'gpt-4o-mini'
  const baseUrl = options.baseUrl ?? 'https://api.openai.com/v1'
  const fetchImpl = options.fetch ?? fetch

  return {
    label: `openai:${model}`,
    async complete({ system, user }: ReasonRequest): Promise<string> {
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
      if (!apiKey) throw new AppFastError('ANALYSIS', 'OPENAI_API_KEY is not set')
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!response.ok) throw new AppFastError('ANALYSIS', `OpenAI request failed: ${response.status}`)
      const json = (await response.json()) as OpenAiChatResponse
      const content = json.choices?.[0]?.message?.content
      if (typeof content !== 'string') throw new AppFastError('ANALYSIS', 'OpenAI response had no content')
      return content
    },
  }
}
