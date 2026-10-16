import type { Bundle } from '../../src/types.js'

/** A minimal valid bundle for analyze tests. */
export function makeBundle(overrides: Partial<Bundle> = {}): Bundle {
  const base: Bundle = {
    bundleVersion: 1,
    engineVersion: '0.0.1',
    target: { url: 'https://example.com', runs: 1, throttle: 'mobile', checks: ['scrollJank'] },
    startedAt: '2026-10-16T00:00:00.000Z',
    durationMs: 1000,
    metrics: [
      {
        name: 'lcp',
        unit: 'ms',
        median: 3120,
        min: 3120,
        max: 3120,
        runs: 1,
        values: [3120],
        thresholds: { good: 2500, needsImprovement: 4000, direction: 'lowerIsBetter' },
      },
    ],
    observations: [
      {
        id: 'scrollJank-0-0',
        check: 'scrollJank',
        kind: 'scrollSummary',
        tMs: 0,
        repeat: 0,
        warm: false,
        payload: { droppedFrameRatio: 0.11 },
      },
    ],
    artifacts: [{ kind: 'lighthouseJson', path: 'run-0/lighthouse.json', bytes: 100, mimeType: 'application/json' }],
    caveats: [],
  }
  return { ...base, ...overrides }
}
