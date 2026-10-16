import { describe, expect, it } from 'vitest'
import { buildDigest } from '../../src/analyze/digest.js'
import { makeBundle } from '../helpers/bundle.js'

describe('buildDigest', () => {
  it('includes the target, metrics with thresholds, and observation ids', () => {
    const digest = buildDigest(makeBundle())
    expect(digest).toContain('https://example.com')
    expect(digest).toContain('lcp: 3120ms')
    expect(digest).toContain('good 2500')
    expect(digest).toContain('[scrollJank-0-0]')
    expect(digest).toContain('scrollJank:scrollSummary')
  })

  it('lists artifact paths but not their contents', () => {
    const digest = buildDigest(makeBundle())
    expect(digest).toContain('lighthouseJson=run-0/lighthouse.json')
  })

  it('truncates to the character budget', () => {
    const digest = buildDigest(makeBundle(), 40)
    expect(digest.length).toBeLessThanOrEqual(60)
    expect(digest).toContain('[digest truncated]')
  })

  it('reports no checks and custom throttle when present', () => {
    const digest = buildDigest(
      makeBundle({
        target: { url: 'https://x.test', runs: 2, throttle: { cpuSlowdown: 2, downloadKbps: 1, uploadKbps: 1, latencyMs: 1 }, checks: [] },
      }),
    )
    expect(digest).toContain('Throttle: custom')
    expect(digest).toContain('Checks: none')
  })
})
