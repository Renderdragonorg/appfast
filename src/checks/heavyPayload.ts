import type { Check, CheckContext } from './types.js'
import type { ObservationDraft } from '../types.js'

export interface HeavyPayloadLongTask {
  durationMs: number
  attribution?: string
  tMs: number
}

export interface HeavyPayloadRaw {
  domNodes: number
  images: number
  imageBytes: number
  firstRenderMs: number
  longTasks: HeavyPayloadLongTask[]
}

export interface HeavyPayloadSummary {
  domNodes: number
  images: number
  imageBytes: number
  layoutMs: number
  scriptMs: number
  firstRenderMs: number
  forcedReflows: number
}

const LAYOUT_ATTRIBUTIONS = new Set([
  'layout',
  'layoutshift',
  'updatelayouttree',
  'recalculatestyle',
  'style',
  'paint',
  'prepaint',
  'composite',
  'compositing',
  'hittest',
  'layerize',
  'updatelayer',
  'updatelayerlist',
])

/** Classifies a long-task attribution name as layout work or script work. */
export function classifyLongTask(attribution?: string): 'layout' | 'script' {
  if (!attribution) return 'script'
  const key = attribution.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return LAYOUT_ATTRIBUTIONS.has(key) ? 'layout' : 'script'
}

/** Returns the p-th percentile (0..100) of a list of numbers using linear interpolation. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0] as number
  const clamped = Math.min(100, Math.max(0, p))
  const index = (clamped / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower] as number
  const weight = index - lower
  return (sorted[lower] as number) * (1 - weight) + (sorted[upper] as number) * weight
}

/** Returns up to `n` items from `items`, ordered by `valueOf` descending. */
export function selectWorst<T>(items: readonly T[], n: number, valueOf: (item: T) => number): T[] {
  return [...items].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, Math.max(0, n))
}

/** Builds the `heavyPayloadSummary` payload from a raw page snapshot. */
export function assembleHeavyPayloadSummary(raw: HeavyPayloadRaw): HeavyPayloadSummary {
  let layoutMs = 0
  let scriptMs = 0
  let forcedReflows = 0
  for (const task of raw.longTasks) {
    if (classifyLongTask(task.attribution) === 'layout') {
      layoutMs += task.durationMs
      forcedReflows += 1
    } else {
      scriptMs += task.durationMs
    }
  }
  return {
    domNodes: raw.domNodes,
    images: raw.images,
    imageBytes: raw.imageBytes,
    layoutMs,
    scriptMs,
    firstRenderMs: raw.firstRenderMs,
    forcedReflows,
  }
}

/** Selects the worst layout-classified long tasks, capped at `n`. */
export function worstLayoutTasks(raw: HeavyPayloadRaw, n: number): HeavyPayloadLongTask[] {
  const layout = raw.longTasks.filter((task) => classifyLongTask(task.attribution) === 'layout')
  return selectWorst(layout, n, (task) => task.durationMs)
}

async function gather(ctx: CheckContext): Promise<HeavyPayloadRaw> {
  return ctx.page.evaluate(() => {
    const started = performance.now()
    const domNodes = document.querySelectorAll('*').length
    const images = document.images.length

    let imageBytes = 0
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    for (const resource of resources) {
      if (resource.initiatorType !== 'img') continue
      const decoded = resource.decodedBodySize
      const transferred = resource.transferSize
      imageBytes += decoded > 0 ? decoded : transferred
    }
    if (imageBytes === 0) {
      for (let i = 0; i < document.images.length; i++) {
        const img = document.images[i]
        if (img) imageBytes += (img.naturalWidth || 0) * (img.naturalHeight || 0) * 4
      }
    }

    const paints = performance.getEntriesByType('paint')
    const firstRenderMs = paints.length > 0 ? (paints[0]?.startTime ?? 0) : 0

    const longTasks: HeavyPayloadLongTask[] = []
    let observer: PerformanceObserver | undefined
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const task = entry as PerformanceEntry & { attribution?: { name?: string }[] }
          longTasks.push({
            durationMs: task.duration,
            attribution: task.attribution?.[0]?.name,
            tMs: Math.max(0, task.startTime - started),
          })
        }
      })
      observer.observe({ type: 'longtask', buffered: true })
    } catch {
      observer = undefined
    }

    return new Promise<HeavyPayloadRaw>((resolve) => {
      setTimeout(() => {
        observer?.disconnect()
        resolve({ domNodes, images, imageBytes, firstRenderMs, longTasks })
      }, 250)
    })
  })
}

/**
 * Loads a page with a large DOM, many images, and a lot of data and measures
 * render and interaction cost. Emits one `heavyPayloadSummary` plus capped
 * `worstLayoutTask` observations (payload shapes in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const heavyPayload: Check = {
  name: 'heavyPayload',
  async run(ctx) {
    const raw = await gather(ctx)
    const summary = assembleHeavyPayloadSummary(raw)
    const worst = worstLayoutTasks(raw, ctx.detailRows)

    const observations: ObservationDraft[] = [
      {
        check: 'heavyPayload',
        kind: 'heavyPayloadSummary',
        tMs: 0,
        repeat: ctx.repeat,
        warm: ctx.warm,
        payload: summary,
      },
    ]
    for (const task of worst) {
      observations.push({
        check: 'heavyPayload',
        kind: 'worstLayoutTask',
        tMs: task.tMs,
        repeat: ctx.repeat,
        warm: ctx.warm,
        payload: task.attribution
          ? { durationMs: task.durationMs, attribution: task.attribution }
          : { durationMs: task.durationMs },
      })
    }
    return observations
  },
}
