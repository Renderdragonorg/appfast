import { RenderDragonError } from '../../errors.js'
import type { Reasoner, ReasonRequest } from '../types.js'

export interface AnthropicReasonerOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  maxTokens?: number
  /** Injectable for tests. Defaults to global fetch. */
  fetch?: typeof fetch
}

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: unknown }>
}

/**
 * A reasoner backed by Anthropic's messages API. Reads `ANTHROPIC_API_KEY`
 * from the environment when no key is passed. Never logs the key.
 */
export function createAnthropicReasoner(options: AnthropicReasonerOptions = {}): Reasoner {
  const model = options.model ?? 'claude-3-5-sonnet-latest'
  const baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1'
  const fetchImpl = options.fetch ?? fetch

  return {
    label: `anthropic:${model}`,
    async complete({ system, user }: ReasonRequest): Promise<string> {
      const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new RenderDragonError('ANALYSIS', 'ANTHROPIC_API_KEY is not set')
      const response = await fetchImpl(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens ?? 2048,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      })
      if (!response.ok) throw new RenderDragonError('ANALYSIS', `Anthropic request failed: ${response.status}`)
      const json = (await response.json()) as AnthropicMessageResponse
      const text = json.content?.find((block) => block.type === 'text')?.text
      if (typeof text !== 'string') throw new RenderDragonError('ANALYSIS', 'Anthropic response had no text content')
      return text
    },
  }
}
