import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assembleLongSessionSummary,
  detectMonotonicGrowth,
  longSessionDurationMs,
  type LongSessionRaw,
} from '../src/checks/longSession.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('detectMonotonicGrowth', () => {
  it('is true for a steady rise', () => {
    expect(detectMonotonicGrowth([1, 2, 3, 4, 5])).toBe(true)
  })

  it('is false for a sawtooth (GC-driven) pattern', () => {
    expect(detectMonotonicGrowth([1, 3, 2, 4, 3, 5])).toBe(false)
  })

  it('is false for a flat or declining series', () => {
    expect(detectMonotonicGrowth([2, 2, 2, 2])).toBe(false)
    expect(detectMonotonicGrowth([5, 4, 3, 2, 1])).toBe(false)
  })

  it('is false for fewer than two samples', () => {
    expect(detectMonotonicGrowth([3])).toBe(false)
    expect(detectMonotonicGrowth([])).toBe(false)
  })
})

describe('assembleLongSessionSummary', () => {
  const raw: LongSessionRaw = {
    durationMs: 10000,
    interactions: 7,
    memoryMb: [10, 12, 15],
    domNodes: [100, 110, 125],
    longTaskCount: 3,
  }

  it('derives start/end/growth for memory and DOM', () => {
    const summary = assembleLongSessionSummary(raw)
    expect(summary.startMemoryMb).toBe(10)
    expect(summary.endMemoryMb).toBe(15)
    expect(summary.memoryGrowthMb).toBe(5)
    expect(summary.startDomNodes).toBe(100)
    expect(summary.endDomNodes).toBe(125)
    expect(summary.domGrowth).toBe(25)
  })

  it('passes duration, interactions, and long-task count through', () => {
    const summary = assembleLongSessionSummary(raw)
    expect(summary.durationMs).toBe(10000)
    expect(summary.interactions).toBe(7)
    expect(summary.longTaskCount).toBe(3)
  })

  it('flags monotonic growth from the memory series', () => {
    expect(assembleLongSessionSummary(raw).monotonicGrowth).toBe(true)
  })

  it('tolerates an empty memory/DOM series', () => {
    const summary = assembleLongSessionSummary({
      durationMs: 0,
      interactions: 0,
      memoryMb: [],
      domNodes: [],
      longTaskCount: 0,
    })
    expect(summary.startMemoryMb).toBe(0)
    expect(summary.endMemoryMb).toBe(0)
    expect(summary.memoryGrowthMb).toBe(0)
    expect(summary.startDomNodes).toBe(0)
    expect(summary.endDomNodes).toBe(0)
    expect(summary.domGrowth).toBe(0)
    expect(summary.monotonicGrowth).toBe(false)
  })
})

describe('longSessionDurationMs', () => {
  it('defaults to two minutes', () => {
    expect(longSessionDurationMs()).toBe(120000)
  })

  it('honours a positive env override', () => {
    vi.stubEnv('APPFAST_LONG_SESSION_MS', '5000')
    expect(longSessionDurationMs()).toBe(5000)
  })

  it('ignores non-numeric and non-positive overrides', () => {
    vi.stubEnv('APPFAST_LONG_SESSION_MS', 'abc')
    expect(longSessionDurationMs()).toBe(120000)
    vi.stubEnv('APPFAST_LONG_SESSION_MS', '0')
    expect(longSessionDurationMs()).toBe(120000)
  })
})
