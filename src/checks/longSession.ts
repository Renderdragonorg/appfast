import type { Check } from './types.js'

/**
 * Interacts for minutes and watches for memory and DOM growth. Opt-in only, not
 * in the default set (ADR 0015). Emits one `longSessionSummary` observation
 * (payload shape in docs/spec.md).
 *
 * Owner: checks thread.
 */
export const longSession: Check = {
  name: 'longSession',
  async run() {
    throw new Error('longSession not implemented')
  },
}
