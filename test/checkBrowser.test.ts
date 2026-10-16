import { describe, expect, it } from 'vitest'
import { kbpsToBytesPerSecond, resolveThrottle } from '../src/browser/checkBrowser.js'
import { resolveTarget } from '../src/defaults.js'

describe('resolveThrottle', () => {
  it('maps mobile to Lighthouse Slow 4G (4x CPU)', () => {
    expect(resolveThrottle('mobile')).toEqual({
      cpuRate: 4,
      latencyMs: 562.5,
      downloadThroughputBps: 188743,
      uploadThroughputBps: 86400,
    })
  })

  it('maps desktop to no throttling', () => {
    expect(resolveThrottle('desktop')).toEqual({
      cpuRate: 1,
      latencyMs: 0,
      downloadThroughputBps: -1,
      uploadThroughputBps: -1,
    })
  })

  it('maps a custom profile to its numbers', () => {
    expect(
      resolveThrottle({ cpuSlowdown: 2.5, downloadKbps: 1024, uploadKbps: 512, latencyMs: 40 }),
    ).toEqual({
      cpuRate: 2.5,
      latencyMs: 40,
      downloadThroughputBps: 131072,
      uploadThroughputBps: 65536,
    })
  })
})

describe('kbpsToBytesPerSecond', () => {
  it('converts kilobits-per-second to bytes-per-second and floors', () => {
    expect(kbpsToBytesPerSecond(1024)).toBe(131072)
    expect(kbpsToBytesPerSecond(1)).toBe(128)
    expect(kbpsToBytesPerSecond(750 * 0.9)).toBe(86400)
  })
})

const hasChrome = Boolean(process.env.RENDERDRAGON_CHROME_PATH)

describe.skipIf(!hasChrome)('launchCheckBrowser (requires RENDERDRAGON_CHROME_PATH)', () => {
  it('launches headless Chrome, sets the viewport, and closes cleanly', async () => {
    const { launchCheckBrowser } = await import('../src/browser/checkBrowser.js')
    const target = resolveTarget({
      url: 'data:text/html,<h1>hi</h1>',
      throttle: 'desktop',
      viewport: { width: 800, height: 600 },
    })
    const browser = await launchCheckBrowser({ target })
    try {
      await browser.page.goto(target.url)
      const viewport = browser.page.viewport()
      expect(viewport?.width).toBe(800)
      expect(viewport?.height).toBe(600)
    } finally {
      await browser.close()
    }
  })
})
