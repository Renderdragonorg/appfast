import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const mkCheck = (name: string) => ({
    name,
    run: vi.fn(async (ctx: { repeat: number; warm: boolean }) => [
      { check: name, kind: 'summary', tMs: 0, repeat: ctx.repeat, warm: ctx.warm, payload: {} },
    ]),
  })
  return {
    runLighthouseCold: vi.fn(),
    launchCheckBrowser: vi.fn(),
    ensureSession: vi.fn(),
    writeBundle: vi.fn(),
    close: vi.fn(),
    CHECKS: {
      scrollJank: mkCheck('scrollJank'),
      heavyPayload: mkCheck('heavyPayload'),
      interactionStorm: mkCheck('interactionStorm'),
      longSession: mkCheck('longSession'),
    },
  }
})

vi.mock('../src/lighthouse/index.js', () => ({ runLighthouseCold: h.runLighthouseCold }))
vi.mock('../src/browser/checkBrowser.js', () => ({ launchCheckBrowser: h.launchCheckBrowser }))
vi.mock('../src/auth.js', () => ({ ensureSession: h.ensureSession }))
vi.mock('../src/bundle/writer.js', () => ({ writeBundle: h.writeBundle }))
vi.mock('../src/checks/registry.js', () => ({ CHECKS: h.CHECKS }))

import { audit } from '../src/audit.js'
import { DEFAULT_CHECKS } from '../src/defaults.js'

const allCheckNames = ['scrollJank', 'heavyPayload', 'interactionStorm', 'longSession'] as const

function resetDefaults() {
  h.runLighthouseCold.mockResolvedValue({ samples: [], artifacts: [] })
  h.launchCheckBrowser.mockImplementation(async () => ({ page: {}, close: h.close }))
  h.ensureSession.mockResolvedValue({ page: {}, refreshed: false })
  h.writeBundle.mockResolvedValue(undefined)
  h.close.mockResolvedValue(undefined)
  for (const name of allCheckNames) {
    h.CHECKS[name].run.mockImplementation(async (ctx: { repeat: number; warm: boolean }) => [
      { check: name, kind: 'summary', tMs: 0, repeat: ctx.repeat, warm: ctx.warm, payload: {} },
    ])
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetDefaults()
})

describe('audit', () => {
  it('runs Lighthouse once and the default checks once for a bare target', async () => {
    const bundle = await audit({ url: 'https://example.com' })

    expect(h.runLighthouseCold).toHaveBeenCalledTimes(1)
    expect(h.launchCheckBrowser).toHaveBeenCalledTimes(1)
    expect(h.writeBundle).toHaveBeenCalledTimes(1)
    for (const name of DEFAULT_CHECKS) {
      expect(h.CHECKS[name].run).toHaveBeenCalledTimes(1)
    }
    expect(h.CHECKS.longSession.run).not.toHaveBeenCalled()
    expect(bundle.bundleVersion).toBe(1)
    expect(bundle.observations).toHaveLength(3)
    expect(bundle.target.checks).toEqual(DEFAULT_CHECKS)
  })

  it('does not launch a check browser when no checks are selected', async () => {
    await audit({ url: 'https://example.com', checks: [] })

    expect(h.launchCheckBrowser).not.toHaveBeenCalled()
    expect(h.ensureSession).not.toHaveBeenCalled()
    expect(h.writeBundle).toHaveBeenCalledTimes(1)
    expect(h.close).not.toHaveBeenCalled()
  })

  it('interleaves Lighthouse and checks per repeat and aggregates metric spread', async () => {
    const lcpValues = [3000, 1000, 2000]
    let call = 0
    h.runLighthouseCold.mockImplementation(async () => {
      const value = lcpValues[call++]!
      return { samples: [{ name: 'lcp' as const, value }], artifacts: [] }
    })

    const bundle = await audit({ url: 'https://example.com', runs: 3 })

    expect(h.runLighthouseCold).toHaveBeenCalledTimes(3)
    expect(h.CHECKS.scrollJank.run).toHaveBeenCalledTimes(3)
    expect(h.launchCheckBrowser).toHaveBeenCalledTimes(1)
    expect(bundle.metrics[0]).toMatchObject({ name: 'lcp', median: 2000, min: 1000, max: 3000, runs: 3 })
    expect(bundle.observations).toHaveLength(9)
    expect(bundle.caveats.some((c) => /warmed browser/.test(c))).toBe(true)
  })

  it('marks repeats after the first as warm', async () => {
    await audit({ url: 'https://example.com', runs: 2 })
    const calls = h.CHECKS.scrollJank.run.mock.calls
    expect(calls.map((c) => (c[0] as { warm: boolean }).warm)).toEqual([false, true])
  })

  it('closes the check browser and wraps a check failure as CHECK', async () => {
    h.CHECKS.scrollJank.run.mockRejectedValue(new Error('boom'))

    await expect(audit({ url: 'https://example.com' })).rejects.toMatchObject({
      name: 'RenderDragonError',
      code: 'CHECK',
      message: expect.stringContaining('scrollJank'),
    })
    expect(h.close).toHaveBeenCalledTimes(1)
    expect(h.writeBundle).not.toHaveBeenCalled()
  })

  it('records a caveat when auth was refreshed mid-run', async () => {
    h.ensureSession.mockResolvedValue({ page: {}, refreshed: true })

    const bundle = await audit({ url: 'https://example.com' })
    expect(bundle.caveats.some((c) => /refreshed/.test(c))).toBe(true)
  })

  it('passes the resolved output directory to the bundle writer', async () => {
    await audit({ url: 'https://example.com', outputDir: '/tmp/rd-out' })
    expect(h.writeBundle).toHaveBeenCalledWith(expect.anything(), '/tmp/rd-out')
  })
})
