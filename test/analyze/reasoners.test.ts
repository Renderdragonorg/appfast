import { describe, expect, it } from 'vitest'
import { createAnthropicReasoner } from '../../src/analyze/reasoners/anthropic.js'
import { createOpenAiReasoner } from '../../src/analyze/reasoners/openai.js'

function captureFetch(reply: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { calls, impl }
}

describe('createOpenAiReasoner', () => {
  it('posts a chat completion and returns the message content', async () => {
    const { calls, impl } = captureFetch({ choices: [{ message: { content: 'hi' } }] })
    const reasoner = createOpenAiReasoner({ apiKey: 'k', model: 'gpt-x', baseUrl: 'https://api.test/v1', fetch: impl })

    expect(await reasoner.complete({ system: 'S', user: 'U' })).toBe('hi')
    expect(reasoner.label).toBe('openai:gpt-x')

    const call = calls[0]!
    expect(call.url).toBe('https://api.test/v1/chat/completions')
    expect((call.init!.headers as Record<string, string>).authorization).toBe('Bearer k')
    const body = JSON.parse(String(call.init!.body))
    expect(body.model).toBe('gpt-x')
    expect(body.messages).toEqual([
      { role: 'system', content: 'S' },
      { role: 'user', content: 'U' },
    ])
  })

  it('throws ANALYSIS on a non-ok response', async () => {
    const { impl } = captureFetch({ error: 'nope' }, 401)
    const reasoner = createOpenAiReasoner({ apiKey: 'k', fetch: impl })
    await expect(reasoner.complete({ system: 's', user: 'u' })).rejects.toMatchObject({ code: 'ANALYSIS' })
  })

  it('throws ANALYSIS without calling out when no key is available', async () => {
    const previous = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      const { calls, impl } = captureFetch({})
      const reasoner = createOpenAiReasoner({ fetch: impl })
      await expect(reasoner.complete({ system: 's', user: 'u' })).rejects.toMatchObject({ code: 'ANALYSIS' })
      expect(calls).toHaveLength(0)
    } finally {
      if (previous !== undefined) process.env.OPENAI_API_KEY = previous
    }
  })
})

describe('createAnthropicReasoner', () => {
  it('posts a message and returns the text block', async () => {
    const { calls, impl } = captureFetch({ content: [{ type: 'text', text: 'yo' }] })
    const reasoner = createAnthropicReasoner({
      apiKey: 'k',
      model: 'claude-x',
      baseUrl: 'https://api.test/v1',
      fetch: impl,
    })

    expect(await reasoner.complete({ system: 'S', user: 'U' })).toBe('yo')
    expect(reasoner.label).toBe('anthropic:claude-x')

    const call = calls[0]!
    expect(call.url).toBe('https://api.test/v1/messages')
    const headers = call.init!.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('k')
    expect(headers['anthropic-version']).toBeTruthy()
    const body = JSON.parse(String(call.init!.body))
    expect(body.system).toBe('S')
    expect(body.messages).toEqual([{ role: 'user', content: 'U' }])
  })

  it('throws ANALYSIS when no key is available', async () => {
    const previous = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const { impl } = captureFetch({})
      const reasoner = createAnthropicReasoner({ fetch: impl })
      await expect(reasoner.complete({ system: 's', user: 'u' })).rejects.toMatchObject({ code: 'ANALYSIS' })
    } finally {
      if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous
    }
  })
})
