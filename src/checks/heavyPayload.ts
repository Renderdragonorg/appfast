import type { Check } from './types.js'

/**
 * Loads a page with a large DOM, many images, and a lot of data and measures
 * render and interaction cost. Emits one `heavyPayloadSummary` plus capped
 * `worstLayoutTask` observations (payload shapes in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const heavyPayload: Check = {
  name: 'heavyPayload',
  async run() {
    throw new Error('heavyPayload not implemented')
  },
}
