import { launch } from 'chrome-launcher'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import type { ResolvedTarget, ThrottleProfile } from '../types.js'

export interface CheckBrowser {
  page: Page
  close(): Promise<void>
}

export interface CheckBrowserInput {
  target: ResolvedTarget
}

/** CDP throttling values derived from a throttle profile. */
export interface CdpThrottle {
  cpuRate: number
  latencyMs: number
  downloadThroughputBps: number
  uploadThroughputBps: number
}

// Lighthouse's mobileSlow4G preset (4x CPU, Slow 4G), mirroring
// @paulirish/trace_engine's throttling constants. Latency is RTT adjusted by
// the DevTools RTT factor; throughputs are the DevTools-adjusted kbps.
const MOBILE_CPU_RATE = 4
const MOBILE_LATENCY_MS = 150 * 3.75
const MOBILE_DOWNLOAD_BPS = Math.floor((1.6 * 1024 * 0.9 * 1024) / 8)
const MOBILE_UPLOAD_BPS = Math.floor((750 * 0.9 * 1024) / 8)

// CDP's sentinel for "no throughput throttling".
const DISABLED_THROUGHPUT = -1

/** Converts kilobits-per-second to the bytes-per-second CDP expects. */
export function kbpsToBytesPerSecond(kbps: number): number {
  return Math.floor((kbps * 1024) / 8)
}

/**
 * Maps a throttle profile to the CDP emulation parameters used to apply it.
 * `mobile` mirrors Lighthouse's mobileSlow4G preset; `desktop` applies no
 * throttling; a custom object passes its numbers through directly.
 */
export function resolveThrottle(profile: ThrottleProfile): CdpThrottle {
  if (profile === 'mobile') {
    return {
      cpuRate: MOBILE_CPU_RATE,
      latencyMs: MOBILE_LATENCY_MS,
      downloadThroughputBps: MOBILE_DOWNLOAD_BPS,
      uploadThroughputBps: MOBILE_UPLOAD_BPS,
    }
  }
  if (profile === 'desktop') {
    return {
      cpuRate: 1,
      latencyMs: 0,
      downloadThroughputBps: DISABLED_THROUGHPUT,
      uploadThroughputBps: DISABLED_THROUGHPUT,
    }
  }
  return {
    cpuRate: profile.cpuSlowdown,
    latencyMs: profile.latencyMs,
    downloadThroughputBps: kbpsToBytesPerSecond(profile.downloadKbps),
    uploadThroughputBps: kbpsToBytesPerSecond(profile.uploadKbps),
  }
}

/**
 * Launches the shared browser the custom checks drive. It persists across
 * repeats and warms up (ADR 0014); it is a separate browser from the one
 * Lighthouse uses (ADR 0011). Uses chrome-launcher (headless=new, its own
 * user-data-dir) and connects over the debugging port with puppeteer-core.
 */
export async function launchCheckBrowser(input: CheckBrowserInput): Promise<CheckBrowser> {
  const { target } = input

  const chrome = await launch({
    chromePath: process.env.RENDERDRAGON_CHROME_PATH || undefined,
    chromeFlags: ['--headless=new'],
  })

  let browser: Browser
  try {
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` })
  } catch (error) {
    chrome.kill()
    throw error
  }

  try {
    const page = await browser.newPage()
    await page.setViewport(target.viewport)

    const throttle = resolveThrottle(target.throttle)
    const session = await page.createCDPSession()
    await session.send('Emulation.setCPUThrottlingRate', { rate: throttle.cpuRate })
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: throttle.latencyMs,
      downloadThroughput: throttle.downloadThroughputBps,
      uploadThroughput: throttle.uploadThroughputBps,
    })

    return {
      page,
      async close() {
        await browser.disconnect()
        chrome.kill()
      },
    }
  } catch (error) {
    await browser.disconnect().catch(() => {})
    chrome.kill()
    throw error
  }
}
