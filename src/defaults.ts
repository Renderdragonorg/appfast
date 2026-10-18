import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppFastError } from './errors.js'
import type { CheckName, ResolvedTarget, Target, ThrottleProfile, Viewport } from './types.js'

export const DEFAULT_RUNS = 1
export const DEFAULT_THROTTLE: ThrottleProfile = 'mobile'
export const DEFAULT_CHECKS: CheckName[] = ['scrollJank', 'heavyPayload', 'interactionStorm']
export const DEFAULT_DETAIL_ROWS = 20

const MOBILE_VIEWPORT: Viewport = { width: 412, height: 823, deviceScaleFactor: 2.625, isMobile: true }
const DESKTOP_VIEWPORT: Viewport = { width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false }

export function defaultViewport(throttle: ThrottleProfile): Viewport {
  return throttle === 'desktop' ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT
}

function assertHttpUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppFastError('CONFIG', `Target url is not a valid URL: ${String(url)}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppFastError('CONFIG', `Target url must be http or https, got ${parsed.protocol}`)
  }
}

export function resolveTarget(target: Target): ResolvedTarget {
  assertHttpUrl(target.url)
  const throttle = target.throttle ?? DEFAULT_THROTTLE
  const resolved: ResolvedTarget = {
    url: target.url,
    runs: target.runs ?? DEFAULT_RUNS,
    throttle,
    viewport: target.viewport ?? defaultViewport(throttle),
    headers: target.headers ?? {},
    cookies: target.cookies ?? [],
    checks: target.checks ?? DEFAULT_CHECKS,
    outputDir: target.outputDir ?? join(tmpdir(), `appfast-${Date.now()}`),
    detailRows: DEFAULT_DETAIL_ROWS,
  }
  if (target.refreshAuth) resolved.refreshAuth = target.refreshAuth
  return resolved
}
