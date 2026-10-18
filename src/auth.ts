import type { CookieParam, Page } from 'puppeteer-core'
import { AppFastError } from './errors.js'
import type { CheckBrowser } from './browser/checkBrowser.js'
import type { Cookie, Credentials, ResolvedTarget } from './types.js'

/** Bounds the page navigation wait so a hung load fails the run instead of hanging. */
const NAVIGATION_TIMEOUT_MS = 60_000

/** Matches a login/auth route or an identity host (e.g. login.example.com). */
const AUTH_PATH_RE = /\/(login|log-?in|signin|sign-?in|signup|sign-?up|auth|sso|oauth|saml)(\/|$|\?)/i
const AUTH_HOST_RE = /(^|\.)(login|auth|sso|oauth|idp)\./i

/**
 * Heuristic logged-out detection: the final URL matches a login/auth pattern and
 * differs from the target URL (ADR 0020). Pure; no browser required.
 */
export function isLoggedOut(targetUrl: string, finalUrl: string): boolean {
  let target: URL
  let final: URL
  try {
    target = new URL(targetUrl)
    final = new URL(finalUrl)
  } catch {
    return false
  }
  if (target.href === final.href) return false
  return AUTH_PATH_RE.test(final.pathname) || AUTH_HOST_RE.test(final.hostname)
}

/**
 * Converts the library's Cookie shape to Puppeteer's CookieParam. Pure; no
 * browser required.
 */
export function toCookieParams(cookies: Cookie[]): CookieParam[] {
  return cookies.map((cookie) => {
    const param: CookieParam = { name: cookie.name, value: cookie.value }
    if (cookie.domain !== undefined) param.domain = cookie.domain
    if (cookie.path !== undefined) param.path = cookie.path
    if (cookie.httpOnly !== undefined) param.httpOnly = cookie.httpOnly
    if (cookie.secure !== undefined) param.secure = cookie.secure
    if (cookie.sameSite !== undefined) param.sameSite = cookie.sameSite
    return param
  })
}

async function applyCredentials(
  page: Page,
  target: Pick<ResolvedTarget, 'headers' | 'cookies'>,
): Promise<void> {
  if (Object.keys(target.headers).length > 0) {
    await page.setExtraHTTPHeaders(target.headers)
  }
  const cookies = toCookieParams(target.cookies)
  if (cookies.length > 0) {
    await page.setCookie(...cookies)
  }
}

async function navigate(page: Page, target: ResolvedTarget): Promise<Page> {
  try {
    await page.goto(target.url, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT_MS })
    return page
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new AppFastError('NAVIGATION', `Navigation to ${target.url} failed: ${detail}`, { cause: error })
  }
}

/** The loaded page plus whether credentials were refreshed to get there. */
export interface SessionResult {
  page: Page
  refreshed: boolean
}

/**
 * Applies the target's headers, cookies, and viewport, then navigates to the
 * target URL. On a detected logout it calls `target.refreshAuth`, re-applies the
 * returned credentials, and retries once; if still logged out, or no refresh is
 * supplied, it throws `AppFastError` with code `AUTH_EXPIRED` (ADR 0020).
 * Reports whether a refresh happened so the orchestrator can add a caveat.
 */
export async function ensureSession(browser: CheckBrowser, target: ResolvedTarget): Promise<SessionResult> {
  const page = browser.page
  await applyCredentials(page, target)
  await page.setViewport(target.viewport)

  let loaded = await navigate(page, target)
  if (!isLoggedOut(target.url, loaded.url())) return { page: loaded, refreshed: false }

  if (!target.refreshAuth) {
    throw new AppFastError(
      'AUTH_EXPIRED',
      `Logged out at ${loaded.url()} and no refreshAuth callback was supplied`,
    )
  }

  const credentials: Credentials = await target.refreshAuth()
  await applyCredentials(page, {
    headers: { ...target.headers, ...(credentials.headers ?? {}) },
    cookies: credentials.cookies ?? target.cookies,
  })

  loaded = await navigate(page, target)
  if (isLoggedOut(target.url, loaded.url())) {
    throw new AppFastError('AUTH_EXPIRED', `Still logged out after refresh at ${loaded.url()}`)
  }
  return { page: loaded, refreshed: true }
}
