import { describe, expect, it } from 'vitest'
import {
  FRAME_BUDGET_MS,
  LONG_TASK_MS,
  computeScrollSummary,
  pickWorst,
  type FrameSample,
} from '../src/checks/scrollJank.js'

describe('FRAME_BUDGET_MS', () => {
  it('is one 60fps frame', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(1000 / 60, 5)
  })
})

describe('LONG_TASK_MS', () => {
  it('is 50ms', () => {
    expect(LONG_TASK_MS).toBe(50)
  })
})

describe('computeScrollSummary', () => {
  const samples: FrameSample[] = [
    { frameMs: 16, scrollY: 0, tMs: 0 },
    { frameMs: 16, scrollY: 100, tMs: 16 },
    { frameMs: 20, scrollY: 200, tMs: 32 },
    { frameMs: 100, scrollY: 300, tMs: 52 },
    { frameMs: 16, scrollY: 250, tMs: 152 },
  ]

  it('aggregates counts, totals, distance and the 95th percentile', () => {
    const summary = computeScrollSummary(samples, 20)
    expect(summary.frames).toBe(5)
    expect(summary.durationMs).toBe(168)
    expect(summary.scrollDistancePx).toBe(350)
    expect(summary.droppedFrames).toBe(1)
    expect(summary.droppedFrameRatio).toBeCloseTo(0.2, 5)
    expect(summary.p95FrameMs).toBe(100)
    expect(summary.worstFrameMs).toBe(100)
    expect(summary.longTaskCount).toBe(1)
    expect(summary.totalLongTaskMs).toBe(50)
    expect(summary.jankTimeMs).toBe(80)
  })

  it('uses the real 60fps budget when not overridden', () => {
    const summary = computeScrollSummary(samples, FRAME_BUDGET_MS)
    expect(summary.droppedFrames).toBe(2)
    expect(summary.jankTimeMs).toBeCloseTo(120 - 2 * FRAME_BUDGET_MS, 5)
  })

  it('handles empty samples', () => {
    expect(computeScrollSummary([], FRAME_BUDGET_MS)).toEqual({
      durationMs: 0,
      scrollDistancePx: 0,
      frames: 0,
      droppedFrames: 0,
      droppedFrameRatio: 0,
      p95FrameMs: 0,
      worstFrameMs: 0,
      longTaskCount: 0,
      totalLongTaskMs: 0,
      jankTimeMs: 0,
    })
  })
})

describe('pickWorst', () => {
  it('returns the top n by score, in descending order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const scores: Record<string, number> = { a: 1, b: 5, c: 3, d: 2 }
    expect(pickWorst(items, 2, (i) => scores[i.id] ?? 0)).toEqual([{ id: 'b' }, { id: 'c' }])
  })

  it('returns fewer than n when there are fewer items', () => {
    expect(pickWorst([3, 1, 2], 10, (x) => x)).toEqual([3, 2, 1])
  })

  it('returns an empty array when n is zero', () => {
    expect(pickWorst([3, 1, 2], 0, (x) => x)).toEqual([])
  })

  it('does not mutate the input', () => {
    const items = [1, 3, 2]
    pickWorst(items, 2, (x) => x)
    expect(items).toEqual([1, 3, 2])
  })
})
