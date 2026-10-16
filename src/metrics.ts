import type { Metric, MetricName, MetricThresholds } from './types.js'

export interface MetricSample {
  name: MetricName
  value: number
}

/**
 * Threshold context for the core metrics. Present in the bundle as context
 * only; the engine never turns these into a pass/fail rating (ADR 0003).
 */
export const METRIC_THRESHOLDS: Record<MetricName, MetricThresholds> = {
  lcp: { good: 2500, needsImprovement: 4000, direction: 'lowerIsBetter' },
  cls: { good: 0.1, needsImprovement: 0.25, direction: 'lowerIsBetter' },
  tbt: { good: 200, needsImprovement: 600, direction: 'lowerIsBetter' },
  ttfb: { good: 800, needsImprovement: 1800, direction: 'lowerIsBetter' },
  fcp: { good: 1800, needsImprovement: 3000, direction: 'lowerIsBetter' },
  speedIndex: { good: 3400, needsImprovement: 5800, direction: 'lowerIsBetter' },
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median() requires at least one value')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] as number
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/**
 * Groups raw per-run samples by metric name and reports median, min, max, and
 * the raw values, so a downstream agent can see spread rather than one number
 * (ADR 0007). The order of first appearance is preserved.
 */
export function aggregateMetrics(samples: readonly MetricSample[]): Metric[] {
  const byName = new Map<MetricName, number[]>()
  for (const sample of samples) {
    const list = byName.get(sample.name)
    if (list) list.push(sample.value)
    else byName.set(sample.name, [sample.value])
  }
  return [...byName.entries()].map(([name, values]) => ({
    name,
    unit: name === 'cls' ? 'unitless' : 'ms',
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    runs: values.length,
    values,
    thresholds: METRIC_THRESHOLDS[name],
  }))
}
