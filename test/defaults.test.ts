import { describe, expect, it } from 'vitest'
import { DEFAULT_CHECKS, DEFAULT_RUNS, resolveTarget } from '../src/defaults.js'

describe('resolveTarget', () => {
  it('applies documented defaults to a bare url', () => {
    const resolved = resolveTarget({ url: 'https://example.com' })
    expect(resolved.url).toBe('https://example.com')
    expect(resolved.runs).toBe(DEFAULT_RUNS)
    expect(resolved.throttle).toBe('mobile')
    expect(resolved.checks).toEqual(DEFAULT_CHECKS)
    expect(resolved.detailRows).toBe(20)
    expect(resolved.outputDir).toMatch(/renderdragon-/)
  })

  it('does not include longSession in the default check set', () => {
    const resolved = resolveTarget({ url: 'https://example.com' })
    expect(resolved.checks).not.toContain('longSession')
  })

  it('honours explicit overrides', () => {
    const resolved = resolveTarget({
      url: 'https://example.com',
      runs: 3,
      throttle: 'desktop',
      checks: ['longSession'],
    })
    expect(resolved.runs).toBe(3)
    expect(resolved.throttle).toBe('desktop')
    expect(resolved.checks).toEqual(['longSession'])
  })
})
