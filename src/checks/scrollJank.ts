import type { Check } from './types.js'

/**
 * Scrolls a loaded page under the run's throttle and records frame timing.
 * Emits one `scrollSummary` plus capped `worstFrame` / `worstLongTask`
 * observations (payload shapes in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const scrollJank: Check = {
  name: 'scrollJank',
  async run() {
    throw new Error('scrollJank not implemented')
  },
}
