import { ensureSession } from './auth.js'
import type { CheckBrowser } from './browser/checkBrowser.js'
import { launchCheckBrowser } from './browser/checkBrowser.js'
import { CHECKS } from './checks/registry.js'
import { resolveTarget } from './defaults.js'
import { runLighthouseCold, type RawMetricSample } from './lighthouse/index.js'
import type { Artifact, Bundle, Metric, MetricName, MetricThresholds, Observation, Target } from './types.js'
import { BUNDLE_VERSION, ENGINE_VERSION } from './version.js'
import { writeBundle } from './bundle/writer.js'

const THRESHOLDS: Record<MetricName, MetricThresholds> = {
  lcp: { good: 2500, needsImprovement: 4000, direction: 'lowerIsBetter' },
  cls: { good: 0.1, needsImprovement: 0.25, direction: 'lowerIsBetter' },
  tbt: { good: 200, needsImprovement: 600, direction: 'lowerIsBetter' },
  ttfb: { good: 800, needsImprovement: 1800, direction: 'lowerIsBetter' },
  fcp: { good: 1800, needsImprovement: 3000, direction: 'lowerIsBetter' },
  speedIndex: { good: 3400, needsImprovement: 5800, direction: 'lowerIsBetter' },
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] as number
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

function aggregateMetrics(samples: RawMetricSample[]): Metric[] {
  const byName = new Map<MetricName, number[]>()
  for (const sample of samples) {
    const list = byName.get(sample.name) ?? []
    list.push(sample.value)
    byName.set(sample.name, list)
  }
  return [...byName.entries()].map(([name, values]) => ({
    name,
    unit: name === 'cls' ? 'unitless' : 'ms',
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    runs: values.length,
    values,
    thresholds: THRESHOLDS[name],
  }))
}

/**
 * Audits one target and returns one evidence bundle. Runs Lighthouse on its own
 * cold browser, then the selected custom checks on a shared warm browser,
 * interleaved per repeat (ADR 0012). Judges nothing and calls no model
 * (ADR 0003, ADR 0004).
 */
export async function audit(target: Target): Promise<Bundle> {
  const resolved = resolveTarget(target)
  const startedAt = new Date().toISOString()
  const startedAtMs = Date.now()

  const samples: RawMetricSample[] = []
  const observations: Observation[] = []
  const artifacts: Artifact[] = []
  const caveats: string[] = []

  let browser: CheckBrowser | undefined
  try {
    for (let repeat = 0; repeat < resolved.runs; repeat++) {
      const run = await runLighthouseCold({ target: resolved, repeat })
      samples.push(...run.samples)
      artifacts.push(...run.artifacts)

      if (resolved.checks.length === 0) continue

      browser ??= await launchCheckBrowser({ target: resolved })
      const page = await ensureSession(browser, resolved)
      const warm = repeat > 0
      for (const name of resolved.checks) {
        const check = CHECKS[name]
        observations.push(
          ...(await check.run({
            page,
            target: resolved,
            repeat,
            warm,
            detailRows: resolved.detailRows,
          })),
        )
      }
    }
  } finally {
    await browser?.close()
  }

  if (resolved.runs > 1 && resolved.checks.length > 0) {
    caveats.push('Check repeats after the first ran on a warmed browser (see ADR 0014).')
  }

  const bundle: Bundle = {
    bundleVersion: BUNDLE_VERSION,
    engineVersion: ENGINE_VERSION,
    target: {
      url: resolved.url,
      runs: resolved.runs,
      throttle: resolved.throttle,
      checks: resolved.checks,
    },
    startedAt,
    durationMs: Date.now() - startedAtMs,
    metrics: aggregateMetrics(samples),
    observations,
    artifacts,
    caveats,
  }

  await writeBundle(bundle, resolved.outputDir)
  return bundle
}
