import { describe, expect, it } from 'vitest'
import {
  summarizeInteractions,
  type InteractionSample,
  type InteractionStormSummary,
} from '../src/checks/interactionStorm.js'

const click = (target: string, inpMs: number): InteractionSample => ({
  kind: 'click',
  target,
  inpMs,
  tMs: 0,
})

describe('summarizeInteractions', () => {
  it('computes median, p95, worst, and counts over measured interactions', () => {
    const samples = [click('button#a', 10), click('button#b', 20), click('button#c', 30), click('button#d', 40), click('button#e', 50)]
    const { summary, worst } = summarizeInteractions(samples, 2, 20)

    expect(summary.interactions).toBe(5)
    expect(summary.inpMs).toBe(30)
    expect(summary.p95InpMs).toBeCloseTo(48)
    expect(summary.worstInpMs).toBe(50)
    expect(summary.droppedInteractions).toBe(2)
    expect(worst.map((s) => s.inpMs)).toEqual([50, 40, 30, 20, 10])
  })

  it('returns zeros for an empty sample set', () => {
    const { summary, worst } = summarizeInteractions([], 0, 20)
    expect(summary).toEqual({
      interactions: 0,
      inpMs: 0,
      p95InpMs: 0,
      worstInpMs: 0,
      droppedInteractions: 0,
    } satisfies InteractionStormSummary)
    expect(worst).toEqual([])
  })

  it('caps the worst list at detailRows', () => {
    const samples = [click('a', 1), click('b', 2), click('c', 3), click('d', 4)]
    const { worst } = summarizeInteractions(samples, 0, 2)
    expect(worst.map((s) => s.inpMs)).toEqual([4, 3])
  })

  it('reports dropped interactions independently of measured ones', () => {
    const samples = [click('a', 5)]
    const { summary } = summarizeInteractions(samples, 9, 20)
    expect(summary.interactions).toBe(1)
    expect(summary.droppedInteractions).toBe(9)
  })
})
