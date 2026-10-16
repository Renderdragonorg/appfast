import type { Artifact, MetricName, ResolvedTarget } from '../types.js'

/** One raw metric reading from a single Lighthouse cold load. */
export interface RawMetricSample {
  name: MetricName
  value: number
}

export interface LighthouseRunResult {
  samples: RawMetricSample[]
  artifacts: Artifact[]
}

export interface LighthouseInput {
  target: ResolvedTarget
  repeat: number
}

/**
 * Runs Lighthouse once against a cold browser and returns raw per-run metric
 * samples plus artifact references. The orchestrator aggregates samples across
 * repeats into medians and spreads.
 *
 * Owner: lighthouse thread. Replace the throw with the real implementation.
 */
export async function runLighthouseCold(_input: LighthouseInput): Promise<LighthouseRunResult> {
  throw new Error('runLighthouseCold not implemented')
}
