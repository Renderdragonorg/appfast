import { describe, expect, it, vi } from 'vitest'
import type { Analysis } from '../src/analyze/types.js'
import { parseArgs, runCli, type CliDeps } from '../src/cli.js'
import { makeBundle } from './helpers/bundle.js'

describe('parseArgs', () => {
  it('returns help for no args, help, or -h', () => {
    expect(parseArgs([])).toEqual({ command: 'help' })
    expect(parseArgs(['help'])).toEqual({ command: 'help' })
    expect(parseArgs(['-h'])).toEqual({ command: 'help' })
  })

  it('parses an audit url with flags', () => {
    expect(
      parseArgs(['audit', 'https://example.com', '--out', 'out', '--runs', '3', '--throttle', 'desktop', '--checks', 'scrollJank, heavyPayload']),
    ).toEqual({
      command: 'audit',
      url: 'https://example.com',
      out: 'out',
      runs: 3,
      throttle: 'desktop',
      checks: ['scrollJank', 'heavyPayload'],
      json: false,
    })
  })

  it('supports --key=value and --json', () => {
    expect(parseArgs(['audit', 'https://x', '--out=dist', '--json'])).toMatchObject({ out: 'dist', json: true })
  })

  it('parses analyze with a provider and model', () => {
    expect(parseArgs(['analyze', 'b.json', '--provider', 'openai', '--model', 'gpt-x'])).toEqual({
      command: 'analyze',
      file: 'b.json',
      provider: 'openai',
      model: 'gpt-x',
      json: false,
    })
  })

  it('rejects a bad runs value, a bad throttle, and unknown commands', () => {
    expect(() => parseArgs(['audit', 'https://x', '--runs', 'zero'])).toThrow(/runs/)
    expect(() => parseArgs(['audit', 'https://x', '--throttle', 'fast'])).toThrow(/throttle/)
    expect(() => parseArgs(['frobnicate'])).toThrow(/Unknown command/)
    expect(() => parseArgs(['audit'])).toThrow(/requires a <url>/)
  })
})

function makeDeps(overrides: Partial<CliDeps> = {}): { deps: CliDeps; out: string[]; err: string[] } {
  const out: string[] = []
  const err: string[] = []
  const deps: CliDeps = {
    audit: vi.fn(async () => makeBundle()),
    analyze: vi.fn(
      async (): Promise<Analysis> => ({
        summary: 'looks slow',
        findings: [
          { id: 'f1', severity: 'high', title: 'Slow LCP', rationale: 'r', evidence: [{ kind: 'metric', ref: 'lcp' }] },
        ],
        analyzedAt: '2026-01-01T00:00:00.000Z',
        reasoner: 'test:model',
      }),
    ),
    createReasoner: vi.fn((provider: string) => ({ label: `${provider}:test`, complete: async () => '{}' })),
    readTextFile: vi.fn(async () => JSON.stringify(makeBundle())),
    io: { out: (m) => out.push(m), err: (m) => err.push(m) },
    env: {},
    ...overrides,
  }
  return { deps, out, err }
}

describe('runCli', () => {
  it('audits and prints a summary, defaulting the output dir', async () => {
    const { deps, out } = makeDeps()
    const code = await runCli(['audit', 'https://example.com'], deps)

    expect(code).toBe(0)
    expect(deps.audit).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com', outputDir: 'appfast-out' }),
    )
    expect(out.join('\n')).toContain('lcp: 3120ms')
    expect(out.join('\n')).toContain('appfast-out')
  })

  it('prints the bundle as JSON with --json', async () => {
    const { deps, out } = makeDeps()
    const code = await runCli(['audit', 'https://example.com', '--json'], deps)

    expect(code).toBe(0)
    expect(JSON.parse(out[0] as string).bundleVersion).toBe(1)
  })

  it('returns exit 1 and reports an audit failure', async () => {
    const { deps, err } = makeDeps({ audit: vi.fn(async () => Promise.reject(new Error('boom'))) })
    const code = await runCli(['audit', 'https://example.com'], deps)
    expect(code).toBe(1)
    expect(err[0]).toContain('boom')
  })

  it('analyzes a bundle, inferring the provider from the environment', async () => {
    const { deps, out } = makeDeps({ env: { ANTHROPIC_API_KEY: 'k' } })
    const code = await runCli(['analyze', 'b.json'], deps)

    expect(code).toBe(0)
    expect(deps.createReasoner).toHaveBeenCalledWith('anthropic', undefined)
    expect(out.join('\n')).toContain('[HIGH] Slow LCP')
  })

  it('passes an explicit opencode model through to the reasoner', async () => {
    const { deps } = makeDeps()
    const code = await runCli(
      ['analyze', 'b.json', '--provider', 'opencode', '--model', 'opencode-go/glm-5.3-flash'],
      deps,
    )

    expect(code).toBe(0)
    expect(deps.createReasoner).toHaveBeenCalledWith('opencode', 'opencode-go/glm-5.3-flash')
  })

  it('fails analyze when no provider is available', async () => {
    const { deps, err } = makeDeps()
    const code = await runCli(['analyze', 'b.json'], deps)
    expect(code).toBe(1)
    expect(err[0]).toMatch(/provider/i)
  })

  it('reports usage on an unknown command', async () => {
    const { deps, err } = makeDeps()
    const code = await runCli(['frobnicate'], deps)
    expect(code).toBe(1)
    expect(err.join('\n')).toContain('Unknown command')
  })
})
