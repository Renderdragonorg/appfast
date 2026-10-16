import { describe, expect, it } from 'vitest'
import { aggregateMetrics, median, METRIC_THRESHOLDS } from '../src/metrics.js'

describe('median', () => {
  it('returns the middle value for an odd count', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middle values for an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('throws on an empty input', () => {
    expect(() => median([])).toThrow()
  })
})

describe('aggregateMetrics', () => {
  it('returns an empty list for no samples', () => {
    expect(aggregateMetrics([])).toEqual([])
  })

  it('reports median, min, max, runs, and raw values across repeats', () => {
    const metrics = aggregateMetrics([
      { name: 'lcp', value: 3000 },
      { name: 'lcp', value: 2000 },
      { name: 'lcp', value: 4000 },
    ])
    expect(metrics).toHaveLength(1)
    const lcp = metrics[0]!
    expect(lcp.median).toBe(3000)
    expect(lcp.min).toBe(2000)
    expect(lcp.max).toBe(4000)
    expect(lcp.runs).toBe(3)
    expect(lcp.values).toEqual([3000, 2000, 4000])
    expect(lcp.unit).toBe('ms')
    expect(lcp.thresholds).toEqual(METRIC_THRESHOLDS.lcp)
  })

  it('marks cls unitless and keeps first-appearance order', () => {
    const metrics = aggregateMetrics([
      { name: 'cls', value: 0.05 },
      { name: 'lcp', value: 2500 },
    ])
    expect(metrics.map((m) => m.name)).toEqual(['cls', 'lcp'])
    expect(metrics[0]!.unit).toBe('unitless')
  })

  it('carries a single sample through unchanged', () => {
    const metrics = aggregateMetrics([{ name: 'ttfb', value: 600 }])
    expect(metrics[0]).toMatchObject({ median: 600, min: 600, max: 600, runs: 1 })
  })
})
