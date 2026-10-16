import type { Page } from 'puppeteer-core'
import type { Check, CheckContext } from './types.js'
import type { Observation } from '../types.js'
import { percentile, selectWorst } from './heavyPayload.js'

export type InteractionKind = 'click' | 'key' | 'route'

export interface InteractionSample {
  kind: InteractionKind
  target: string
  inpMs: number
  tMs: number
}

export interface InteractionStormSummary {
  interactions: number
  inpMs: number
  p95InpMs: number
  worstInpMs: number
  droppedInteractions: number
}

/** Builds the `interactionStormSummary` payload and the capped worst list. */
export function summarizeInteractions(
  samples: readonly InteractionSample[],
  dropped: number,
  detailRows: number,
): { summary: InteractionStormSummary; worst: InteractionSample[] } {
  const latencies = samples.map((sample) => sample.inpMs)
  const summary: InteractionStormSummary = {
    interactions: samples.length,
    inpMs: percentile(latencies, 50),
    p95InpMs: percentile(latencies, 95),
    worstInpMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    droppedInteractions: dropped,
  }
  return { summary, worst: selectWorst(samples, detailRows, (sample) => sample.inpMs) }
}

const CLICK_SELECTOR = 'button, [role="button"], input[type="button"], input[type="submit"]'
const TEXT_SELECTOR =
  'input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]'
const PROBE_TEXT = 'renderdragon probe'
const MAX_CLICKS = 10
const MAX_TYPES = 5
const ROUTE_COUNT = 3

async function installObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const holder = window as unknown as { __rdEventTiming?: InteractionSample[] }
    holder.__rdEventTiming = []
    const started = performance.now()
    const describe = (el: Element | null): string => {
      if (!el) return 'unknown'
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const cls =
        el.className && typeof el.className === 'string'
          ? `.${el.className.trim().split(/\s+/)[0]}`
          : ''
      return `${tag}${id}${cls}`
    }
    const kindOf = (type: string): InteractionKind | undefined => {
      if (/^(pointer|mouse|click)/i.test(type)) return 'click'
      if (/^(key|input|change|beforeinput)/i.test(type)) return 'key'
      return undefined
    }
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const event = entry as PerformanceEntry & {
            interactionId?: number
            target?: Node | null
          }
          if (!event.interactionId) continue
          const kind = kindOf(event.name)
          if (!kind) continue
          holder.__rdEventTiming!.push({
            kind,
            target: describe(event.target as Element | null),
            inpMs: event.duration,
            tMs: Math.max(0, event.startTime - started),
          })
        }
      })
      observer.observe({
        type: 'event',
        buffered: true,
        durationThreshold: 0,
      } as unknown as PerformanceObserverInit)
    } catch {}
  })
}

async function collectEventTiming(page: Page): Promise<InteractionSample[]> {
  return page.evaluate(() => {
    const holder = window as unknown as { __rdEventTiming?: InteractionSample[] }
    return holder.__rdEventTiming ?? []
  })
}

async function driveRoutes(page: Page, count: number): Promise<InteractionSample[]> {
  return page.evaluate(async (routeCount) => {
    const started = performance.now()
    const samples: InteractionSample[] = []
    for (let i = 0; i < routeCount; i++) {
      const t0 = performance.now()
      location.hash = `renderdragon-${i}`
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      samples.push({
        kind: 'route',
        target: `${location.pathname}#${location.hash}`,
        inpMs: performance.now() - t0,
        tMs: t0 - started,
      })
    }
    return samples
  }, count)
}

/**
 * Drives rapid clicks, typing, and route changes and measures INP under stress.
 * Emits one `interactionStormSummary` plus capped `worstInteraction`
 * observations (payload shapes in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const interactionStorm: Check = {
  name: 'interactionStorm',
  async run(ctx) {
    const { page, repeat, warm, detailRows } = ctx
    await installObserver(page)

    let driven = 0

    const clickables = await page.$$(CLICK_SELECTOR)
    for (const handle of clickables.slice(0, MAX_CLICKS)) {
      driven += 1
      try {
        await handle.click({ delay: 15 })
      } catch {}
    }

    const inputs = await page.$$(TEXT_SELECTOR)
    for (const handle of inputs.slice(0, MAX_TYPES)) {
      driven += 1
      try {
        await handle.type(PROBE_TEXT, { delay: 15 })
      } catch {}
    }

    const eventSamples = await collectEventTiming(page)
    const routeSamples = await driveRoutes(page, ROUTE_COUNT)

    const samples: InteractionSample[] = [...eventSamples, ...routeSamples]
    const dropped = Math.max(0, driven - eventSamples.length)
    const { summary, worst } = summarizeInteractions(samples, dropped, detailRows)

    const observations: Observation[] = [
      {
        check: 'interactionStorm',
        kind: 'interactionStormSummary',
        tMs: 0,
        repeat,
        warm,
        payload: summary,
      },
    ]
    for (const sample of worst) {
      observations.push({
        check: 'interactionStorm',
        kind: 'worstInteraction',
        tMs: sample.tMs,
        repeat,
        warm,
        payload: { kind: sample.kind, target: sample.target, inpMs: sample.inpMs },
      })
    }
    return observations
  },
}
