import { ensureSession } from './auth.js'
import type { CheckBrowser } from './browser/checkBrowser.js'
import { launchCheckBrowser } from './browser/checkBrowser.js'
import { CHECKS } from './checks/registry.js'
import { resolveTarget } from './defaults.js'
import { runLighthouseCold, type RawMetricSample } from './lighthouse/index.js'
import { aggregateMetrics } from './metrics.js'
import type { Artifact, Bundle, Observation, Target } from './types.js'
import { BUNDLE_VERSION, ENGINE_VERSION } from './version.js'
import { writeBundle } from './bundle/writer.js'

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
