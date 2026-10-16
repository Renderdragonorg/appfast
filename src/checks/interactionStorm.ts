import type { Check } from './types.js'

/**
 * Drives rapid clicks, typing, and route changes and measures INP under stress.
 * Emits one `interactionStormSummary` plus capped `worstInteraction`
 * observations (payload shapes in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const interactionStorm: Check = {
  name: 'interactionStorm',
  async run() {
    throw new Error('interactionStorm not implemented')
  },
}
