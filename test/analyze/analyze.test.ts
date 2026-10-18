import { describe, expect, it, vi } from 'vitest'
import { analyze } from '../../src/analyze/analyze.js'
import type { Reasoner } from '../../src/analyze/types.js'
import { makeBundle } from '../helpers/bundle.js'

function reasonerReturning(...replies: string[]): Reasoner & { complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn()
  for (const reply of replies) complete.mockResolvedValueOnce(reply)
  return { label: 'test:model', complete }
}

const validReply = JSON.stringify({
  summary: 'LCP is over the good threshold and scrolling drops frames.',
  findings: [
    {
      id: 'lcp-slow',
      severity: 'high',
      title: 'LCP above good threshold',
      rationale: 'LCP is 3120ms against a 2500ms good threshold.',
      evidence: [
        { kind: 'metric', ref: 'lcp' },
        { kind: 'observation', ref: 'scrollJank-0-0' },
      ],
    },
  ],
})

describe('analyze', () => {
  it('parses valid output and keeps evidence that exists in the bundle', async () => {
    const analysis = await analyze(makeBundle(), reasonerReturning(validReply))
    expect(analysis.summary).toContain('LCP')
    expect(analysis.reasoner).toBe('test:model')
    expect(analysis.findings).toHaveLength(1)
    expect(analysis.findings[0]!.severity).toBe('high')
    expect(analysis.findings[0]!.evidence).toEqual([
      { kind: 'metric', ref: 'lcp' },
      { kind: 'observation', ref: 'scrollJank-0-0' },
    ])
    expect(analysis.analyzedAt).toMatch(/^\d{4}-/)
  })

  it('drops evidence references that do not exist in the bundle', async () => {
    const reply = JSON.stringify({
      summary: 's',
      findings: [
        {
          severity: 'low',
          title: 't',
          rationale: 'r',
          evidence: [
            { kind: 'metric', ref: 'lcp' },
            { kind: 'metric', ref: 'bogus' },
            { kind: 'observation', ref: 'nope' },
            { kind: 'unknown', ref: 'lcp' },
          ],
        },
      ],
    })
    const analysis = await analyze(makeBundle(), reasonerReturning(reply))
    expect(analysis.findings[0]!.evidence).toEqual([{ kind: 'metric', ref: 'lcp' }])
    expect(analysis.findings[0]!.id).toBe('finding-1')
  })

  it('accepts JSON wrapped in a code fence', async () => {
    const analysis = await analyze(makeBundle(), reasonerReturning('```json\n' + validReply + '\n```'))
    expect(analysis.findings).toHaveLength(1)
  })

  it('retries once on invalid output and then throws ANALYSIS', async () => {
    const reasoner = reasonerReturning('not json', 'still not json')
    await expect(analyze(makeBundle(), reasoner)).rejects.toMatchObject({
      name: 'AppFastError',
      code: 'ANALYSIS',
    })
    expect(reasoner.complete).toHaveBeenCalledTimes(2)
  })

  it('succeeds when the retry produces valid output', async () => {
    const reasoner = reasonerReturning('garbage', validReply)
    const analysis = await analyze(makeBundle(), reasoner)
    expect(analysis.findings).toHaveLength(1)
    expect(reasoner.complete).toHaveBeenCalledTimes(2)
    expect(String(reasoner.complete.mock.calls[1]![0].user)).toContain('rejected')
  })

  it('rejects a finding with an invalid severity', async () => {
    const reply = JSON.stringify({ summary: 's', findings: [{ severity: 'urgent', title: 't', rationale: 'r' }] })
    await expect(analyze(makeBundle(), reasonerReturning(reply))).rejects.toMatchObject({ code: 'ANALYSIS' })
  })
})
