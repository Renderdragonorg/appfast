import type { Check, CheckContext } from './types.js'
import type { ObservationDraft } from '../types.js'

export interface LongSessionRaw {
  durationMs: number
  interactions: number
  memoryMb: number[]
  domNodes: number[]
  longTaskCount: number
}

export interface LongSessionSummary {
  durationMs: number
  interactions: number
  startMemoryMb: number
  endMemoryMb: number
  memoryGrowthMb: number
  startDomNodes: number
  endDomNodes: number
  domGrowth: number
  longTaskCount: number
  monotonicGrowth: boolean
}

/** Default long-session duration in ms. */
export const DEFAULT_LONG_SESSION_MS = 120000

/**
 * Returns the configured long-session duration. Override with the
 * `APPFAST_LONG_SESSION_MS` env var so tests can stay fast.
 */
export function longSessionDurationMs(): number {
  const raw = process.env.APPFAST_LONG_SESSION_MS
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_LONG_SESSION_MS
}

/**
 * Detects steady, monotonic memory growth as opposed to a sawtooth (GC-driven)
 * pattern. Returns true when the series ends higher than it starts and most of
 * the movement is upward.
 */
export function detectMonotonicGrowth(samples: number[], tolerance = 0.25): boolean {
  if (samples.length < 2) return false
  const first = samples[0] as number
  const last = samples[samples.length - 1] as number
  if (last <= first) return false
  let up = 0
  let down = 0
  for (let i = 1; i < samples.length; i++) {
    const delta = (samples[i] as number) - (samples[i - 1] as number)
    if (delta > 0) up += delta
    else down += -delta
  }
  if (up === 0) return false
  return down <= tolerance * up
}

/** Builds the `longSessionSummary` payload from a raw sampling session. */
export function assembleLongSessionSummary(raw: LongSessionRaw): LongSessionSummary {
  const startMemoryMb = raw.memoryMb[0] ?? 0
  const endMemoryMb = raw.memoryMb[raw.memoryMb.length - 1] ?? startMemoryMb
  const startDomNodes = raw.domNodes[0] ?? 0
  const endDomNodes = raw.domNodes[raw.domNodes.length - 1] ?? startDomNodes
  return {
    durationMs: raw.durationMs,
    interactions: raw.interactions,
    startMemoryMb,
    endMemoryMb,
    memoryGrowthMb: endMemoryMb - startMemoryMb,
    startDomNodes,
    endDomNodes,
    domGrowth: endDomNodes - startDomNodes,
    longTaskCount: raw.longTaskCount,
    monotonicGrowth: detectMonotonicGrowth(raw.memoryMb),
  }
}

interface SessionRaw {
  memoryMb: number[]
  domNodes: number[]
  longTaskCount: number
  interactions: number
}

async function sample(ctx: CheckContext, durationMs: number): Promise<SessionRaw> {
  const intervalMs = Math.max(1000, Math.round(durationMs / 60))
  return ctx.page.evaluate(async ({ durationMs, intervalMs }) => {
    const memoryMb: number[] = []
    const domNodes: number[] = []
    let longTaskCount = 0
    let interactions = 0

    const record = () => {
      const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
      const heap = memory && typeof memory.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : 0
      memoryMb.push(heap / 1048576)
      domNodes.push(document.querySelectorAll('*').length)
    }

    let observer: PerformanceObserver | undefined
    try {
      observer = new PerformanceObserver((list) => {
        longTaskCount += list.getEntries().length
      })
      observer.observe({ type: 'longtask', buffered: true })
    } catch {
      observer = undefined
    }

    record()

    const deadline = performance.now() + durationMs
    while (performance.now() < deadline) {
      try {
        window.scrollBy(0, 300)
        interactions += 1
      } catch {}
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
      record()
    }

    observer?.disconnect()
    return { memoryMb, domNodes, longTaskCount, interactions }
  }, { durationMs, intervalMs })
}

/**
 * Interacts for minutes and watches for memory and DOM growth. Opt-in only, not
 * in the default set (ADR 0015). Emits one `longSessionSummary` observation
 * (payload shape in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const longSession: Check = {
  name: 'longSession',
  async run(ctx) {
    const startedAt = Date.now()
    const durationMs = longSessionDurationMs()
    const raw = await sample(ctx, durationMs)
    const summary = assembleLongSessionSummary({
      durationMs: Date.now() - startedAt,
      interactions: raw.interactions,
      memoryMb: raw.memoryMb,
      domNodes: raw.domNodes,
      longTaskCount: raw.longTaskCount,
    })

    const observations: ObservationDraft[] = [
      {
        check: 'longSession',
        kind: 'longSessionSummary',
        tMs: 0,
        repeat: ctx.repeat,
        warm: ctx.warm,
        payload: summary,
      },
    ]
    return observations
  },
}
