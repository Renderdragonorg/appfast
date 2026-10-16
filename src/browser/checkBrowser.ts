import type { Page } from 'puppeteer-core'
import type { ResolvedTarget } from '../types.js'

export interface CheckBrowser {
  page: Page
  close(): Promise<void>
}

export interface CheckBrowserInput {
  target: ResolvedTarget
}

/**
 * Launches the shared browser the custom checks drive. It persists across
 * repeats and warms up (ADR 0014); it is a separate browser from the one
 * Lighthouse uses (ADR 0011).
 *
 * Owner: check-browser thread. Replace the throw with the real implementation.
 */
export async function launchCheckBrowser(_input: CheckBrowserInput): Promise<CheckBrowser> {
  throw new Error('launchCheckBrowser not implemented')
}
