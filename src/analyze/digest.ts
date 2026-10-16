import type { Bundle } from '../types.js'

/**
 * Renders a bundle into a compact text digest for a model. Observations keep
 * their ids so the model can cite them, but artifact contents are reduced to
 * paths, since traces are far too large to send.
 */
export function buildDigest(bundle: Bundle, maxChars = 16000): string {
  const throttle = typeof bundle.target.throttle === 'string' ? bundle.target.throttle : 'custom'
  const lines: string[] = [
    `Target: ${bundle.target.url}`,
    `Runs: ${bundle.target.runs}  Throttle: ${throttle}  Checks: ${bundle.target.checks.join(', ') || 'none'}`,
    '',
    'Metrics (median [min..max], threshold good / needs-improvement):',
  ]

  for (const metric of bundle.metrics) {
    const unit = metric.unit === 'ms' ? 'ms' : ''
    const threshold = metric.thresholds
      ? ` (good ${metric.thresholds.good} / ni ${metric.thresholds.needsImprovement})`
      : ''
    lines.push(`- ${metric.name}: ${metric.median}${unit} [${metric.min}..${metric.max}]${threshold}`)
  }

  lines.push('', `Observations (${bundle.observations.length}):`)
  for (const observation of bundle.observations) {
    lines.push(
      `- [${observation.id}] ${observation.check}:${observation.kind} repeat=${observation.repeat} warm=${observation.warm} tMs=${observation.tMs} ${JSON.stringify(observation.payload)}`,
    )
  }

  if (bundle.artifacts.length > 0) {
    lines.push('', `Artifacts (paths only): ${bundle.artifacts.map((a) => `${a.kind}=${a.path}`).join(', ')}`)
  }
  if (bundle.caveats.length > 0) {
    lines.push('', `Caveats: ${bundle.caveats.join(' | ')}`)
  }

  const text = lines.join('\n')
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n[digest truncated]` : text
}
