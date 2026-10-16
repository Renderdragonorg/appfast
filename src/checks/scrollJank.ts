import type { Page } from 'puppeteer-core'
import type { ObservationDraft } from '../types.js'
import type { Check } from './types.js'

/** Frame budget: one 60fps frame, in milliseconds. */
export const FRAME_BUDGET_MS = 1000 / 60

/** Long Task API threshold: a task is "long" when it exceeds 50ms. */
export const LONG_TASK_MS = 50

/** How long the check scrolls the page while sampling frames, in ms. */
export const SCROLL_DURATION_MS = 6000

/** Pixels advanced per sampled frame. */
const SCROLL_STEP_PX = 60

/** A single frame sample captured during the scroll. */
export interface FrameSample {
  /** Milliseconds between this frame and the previous one. */
  frameMs: number
  /** Vertical scroll offset at this frame, in CSS pixels. */
  scrollY: number
  /** Milliseconds since the check's scroll started. */
  tMs: number
}

/** Payload of a `scrollSummary` observation (see docs/spec.md). */
export interface ScrollSummary {
  durationMs: number
  scrollDistancePx: number
  frames: number
  droppedFrames: number
  droppedFrameRatio: number
  p95FrameMs: number
  worstFrameMs: number
  longTaskCount: number
  totalLongTaskMs: number
  jankTimeMs: number
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(p * sorted.length) - 1)
  return sorted[index] ?? 0
}

/**
 * Aggregates raw frame samples into the `scrollSummary` payload. A frame is
 * "dropped" when it exceeds `budgetMs`; `jankTimeMs` is the total time over
 * that budget. Long tasks are frames over 50ms, and `totalLongTaskMs` sums the
 * time each long frame spent past the 50ms threshold (Total Blocking Time).
 */
export function computeScrollSummary(samples: readonly FrameSample[], budgetMs: number): ScrollSummary {
  const frameMs = samples.map((s) => s.frameMs)

  let durationMs = 0
  let droppedFrames = 0
  let jankTimeMs = 0
  let longTaskCount = 0
  let totalLongTaskMs = 0
  let worstFrameMs = 0

  for (const ms of frameMs) {
    durationMs += ms
    if (ms > budgetMs) {
      droppedFrames++
      jankTimeMs += ms - budgetMs
    }
    if (ms > LONG_TASK_MS) {
      longTaskCount++
      totalLongTaskMs += ms - LONG_TASK_MS
    }
    if (ms > worstFrameMs) worstFrameMs = ms
  }

  let scrollDistancePx = 0
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]?.scrollY ?? 0
    const curr = samples[i]?.scrollY ?? 0
    scrollDistancePx += Math.abs(curr - prev)
  }

  const frames = samples.length
  return {
    durationMs,
    scrollDistancePx,
    frames,
    droppedFrames,
    droppedFrameRatio: frames === 0 ? 0 : droppedFrames / frames,
    p95FrameMs: percentile(frameMs, 0.95),
    worstFrameMs,
    longTaskCount,
    totalLongTaskMs,
    jankTimeMs,
  }
}

/**
 * Returns up to `n` items with the highest `score`, in descending order.
 * Stable for equal scores and never mutates the input.
 */
export function pickWorst<T>(items: readonly T[], n: number, score: (item: T) => number): T[] {
  if (n <= 0) return []
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n)
}

/** Scrolls the page while recording rAF frame timings, returning the samples. */
async function sampleScroll(page: Page, durationMs: number, stepPx: number): Promise<FrameSample[]> {
  return page.evaluate(
    async (dur, step) => {
      const html = document.documentElement
      const previousBehavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'

      const samples: FrameSample[] = []
      const start = performance.now()
      let prev = start

      await new Promise<void>((resolve) => {
        const tick = () => {
          const now = performance.now()
          const elapsed = now - start
          samples.push({ frameMs: now - prev, scrollY: window.scrollY, tMs: elapsed })
          prev = now
          if (elapsed >= dur) {
            resolve()
            return
          }
          window.scrollBy(0, elapsed < dur / 2 ? step : -step)
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

      html.style.scrollBehavior = previousBehavior
      return samples
    },
    durationMs,
    stepPx,
  )
}

/**
 * Scrolls a loaded page under the run's throttle and records frame timing.
 * Emits one `scrollSummary` plus capped `worstFrame` / `worstLongTask`
 * observations (payload shapes in docs/spec.md).
 */
export const scrollJank: Check = {
  name: 'scrollJank',
  async run(ctx) {
    const { page, repeat, warm, detailRows } = ctx
    const budgetMs = FRAME_BUDGET_MS
    const samples = await sampleScroll(page, SCROLL_DURATION_MS, SCROLL_STEP_PX)

    const observations: ObservationDraft[] = [
      {
        check: 'scrollJank',
        kind: 'scrollSummary',
        tMs: 0,
        repeat,
        warm,
        payload: computeScrollSummary(samples, budgetMs),
      },
    ]

    for (const sample of pickWorst(samples, detailRows, (s) => s.frameMs)) {
      observations.push({
        check: 'scrollJank',
        kind: 'worstFrame',
        tMs: sample.tMs,
        repeat,
        warm,
        payload: { frameMs: sample.frameMs, budgetMs, scrollYAtFrame: sample.scrollY },
      })
    }

    const longTasks = samples.filter((s) => s.frameMs > LONG_TASK_MS)
    for (const sample of pickWorst(longTasks, detailRows, (s) => s.frameMs)) {
      observations.push({
        check: 'scrollJank',
        kind: 'worstLongTask',
        tMs: sample.tMs,
        repeat,
        warm,
        payload: { durationMs: sample.frameMs },
      })
    }

    return observations
  },
}
