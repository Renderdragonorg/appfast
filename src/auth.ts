import type { Page } from 'puppeteer-core'
import type { CheckBrowser } from './browser/checkBrowser.js'
import type { ResolvedTarget } from './types.js'

/**
 * Applies the target's headers and cookies, navigates the check browser to the
 * target URL, and returns the loaded page. Detects a logged-out state; on
 * detection calls target.refreshAuth, re-applies credentials, and retries once.
 * If still logged out, throws a RenderDragonError with code AUTH_EXPIRED
 * (ADR 0020).
 *
 * Owner: bundle/auth thread.
 */
export async function ensureSession(_browser: CheckBrowser, _target: ResolvedTarget): Promise<Page> {
  throw new Error('ensureSession not implemented')
}
