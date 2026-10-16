import { describe, expect, it } from 'vitest'
import {
  assembleHeavyPayloadSummary,
  classifyLongTask,
  percentile,
  selectWorst,
  worstLayoutTasks,
  type HeavyPayloadLongTask,
  type HeavyPayloadRaw,
} from '../src/checks/heavyPayload.js'

describe('classifyLongTask', () => {
  it('classifies layout-phase attributions as layout', () => {
    expect(classifyLongTask('Layout')).toBe('layout')
    expect(classifyLongTask('UpdateLayoutTree')).toBe('layout')
    expect(classifyLongTask('paint')).toBe('layout')
    expect(classifyLongTask('RecalculateStyle')).toBe('layout')
  })

  it('classifies script and unknown attributions as script', () => {
    expect(classifyLongTask('self')).toBe('script')
    expect(classifyLongTask('https://cdn.example.com/app.js')).toBe('script')
    expect(classifyLongTask(undefined)).toBe('script')
  })
})

describe('percentile', () => {
  it('returns 0 for an empty list', () => {
    expect(percentile([], 95)).toBe(0)
  })

  it('returns the sole value for a single-element list', () => {
    expect(percentile([7], 50)).toBe(7)
  })

  it('computes a linear-interpolated percentile', () => {
    const values = [1, 2, 3, 4, 5]
    expect(percentile(values, 0)).toBe(1)
    expect(percentile(values, 50)).toBe(3)
    expect(percentile(values, 95)).toBeCloseTo(4.8)
    expect(percentile(values, 100)).toBe(5)
  })
})

describe('selectWorst', () => {
  const items = [
    { id: 'a', ms: 5 },
    { id: 'b', ms: 1 },
    { id: 'c', ms: 3 },
    { id: 'd', ms: 8 },
  ]

  it('returns items ordered by the value function, descending', () => {
    const worst = selectWorst(items, 4, (i) => i.ms)
    expect(worst.map((i) => i.id)).toEqual(['d', 'a', 'c', 'b'])
  })

  it('caps the result at n', () => {
    expect(selectWorst(items, 2, (i) => i.ms).map((i) => i.id)).toEqual(['d', 'a'])
  })

  it('returns an empty list for n <= 0 or empty input', () => {
    expect(selectWorst(items, 0, (i) => i.ms)).toEqual([])
    expect(selectWorst([], 3, (i: number) => i)).toEqual([])
  })
})

describe('assembleHeavyPayloadSummary', () => {
  const longTasks: HeavyPayloadLongTask[] = [
    { durationMs: 40, attribution: 'Layout', tMs: 10 },
    { durationMs: 80, attribution: 'UpdateLayoutTree', tMs: 20 },
    { durationMs: 120, attribution: 'self', tMs: 30 },
    { durationMs: 15, attribution: 'paint', tMs: 40 },
  ]

  const raw: HeavyPayloadRaw = {
    domNodes: 5000,
    images: 42,
    imageBytes: 123456,
    firstRenderMs: 320,
    longTasks,
  }

  it('sums layout vs script durations and counts forced reflows', () => {
    const summary = assembleHeavyPayloadSummary(raw)
    expect(summary.layoutMs).toBe(40 + 80 + 15)
    expect(summary.scriptMs).toBe(120)
    expect(summary.forcedReflows).toBe(3)
  })

  it('passes the static payload fields through unchanged', () => {
    const summary = assembleHeavyPayloadSummary(raw)
    expect(summary.domNodes).toBe(5000)
    expect(summary.images).toBe(42)
    expect(summary.imageBytes).toBe(123456)
    expect(summary.firstRenderMs).toBe(320)
  })
})

describe('worstLayoutTasks', () => {
  const longTasks: HeavyPayloadLongTask[] = [
    { durationMs: 20, attribution: 'Layout', tMs: 1 },
    { durationMs: 90, attribution: 'UpdateLayoutTree', tMs: 2 },
    { durationMs: 200, attribution: 'self', tMs: 3 },
    { durationMs: 45, attribution: 'paint', tMs: 4 },
  ]

  it('keeps only layout tasks, sorted worst-first and capped', () => {
    const worst = worstLayoutTasks({ domNodes: 0, images: 0, imageBytes: 0, firstRenderMs: 0, longTasks }, 3)
    expect(worst.map((t) => t.durationMs)).toEqual([90, 45, 20])
  })

  it('respects the cap', () => {
    const worst = worstLayoutTasks({ domNodes: 0, images: 0, imageBytes: 0, firstRenderMs: 0, longTasks }, 2)
    expect(worst.map((t) => t.durationMs)).toEqual([90, 45])
  })
})
