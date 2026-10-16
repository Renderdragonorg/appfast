import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Result as LighthouseResult } from 'lighthouse'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extractMetricSamples, runLighthouseCold } from '../src/lighthouse/index.js'
import type { ResolvedTarget } from '../src/types.js'

function lhrWithAudits(audits: Record<string, { numericValue?: number } | undefined>): LighthouseResult {
  return { audits } as unknown as LighthouseResult
}

describe('extractMetricSamples', () => {
  it('maps the six curated audits in canonical order', () => {
    const lhr = lhrWithAudits({
      'largest-contentful-paint': { numericValue: 3120 },
      'cumulative-layout-shift': { numericValue: 0.04 },
      'total-blocking-time': { numericValue: 200 },
      'server-response-time': { numericValue: 150 },
      'first-contentful-paint': { numericValue: 1800 },
      'speed-index': { numericValue: 3400 },
    })
    expect(extractMetricSamples(lhr)).toEqual([
      { name: 'lcp', value: 3120 },
      { name: 'cls', value: 0.04 },
      { name: 'tbt', value: 200 },
      { name: 'ttfb', value: 150 },
      { name: 'fcp', value: 1800 },
      { name: 'speedIndex', value: 3400 },
    ])
  })

  it('skips missing, undefined, null, and NaN values', () => {
    const lhr = lhrWithAudits({
      'largest-contentful-paint': { numericValue: 100 },
      'cumulative-layout-shift': { numericValue: undefined },
      'total-blocking-time': { numericValue: NaN },
      'server-response-time': { numericValue: null as unknown as number },
      'speed-index': { numericValue: 900 },
    })
    expect(extractMetricSamples(lhr)).toEqual([
      { name: 'lcp', value: 100 },
      { name: 'speedIndex', value: 900 },
    ])
  })
})

const chromePath = process.env.RENDERDRAGON_CHROME_PATH

describe.skipIf(!chromePath)('runLighthouseCold (real browser)', () => {
  let server: ReturnType<typeof createServer>
  let url: string
  let outputDir: string

  beforeAll(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'renderdragon-lh-test-'))
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<!doctype html><html><head><title>perf</title></head><body><main>Hello RenderDragon</main></body></html>')
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    url = `http://127.0.0.1:${port}/`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
    await rm(outputDir, { recursive: true, force: true })
  })

  it('writes lighthouse.json and returns metric samples', async () => {
    const target: ResolvedTarget = {
      url,
      runs: 1,
      throttle: 'mobile',
      viewport: { width: 412, height: 823, deviceScaleFactor: 2.625, isMobile: true },
      headers: {},
      cookies: [],
      checks: [],
      outputDir,
      detailRows: 20,
    }
    const result = await runLighthouseCold({ target, repeat: 0 })
    const jsonArtifact = result.artifacts.find((a) => a.kind === 'lighthouseJson')
    expect(jsonArtifact).toBeDefined()
    const bytes = await readFile(join(outputDir, jsonArtifact!.path))
    const parsed = JSON.parse(bytes.toString()) as { requestedUrl?: string }
    expect(parsed.requestedUrl).toBe(url)
    expect(jsonArtifact!.mimeType).toBe('application/json')
    expect(jsonArtifact!.bytes).toBeGreaterThan(0)
    expect(result.samples.some((s) => s.name === 'fcp')).toBe(true)
  })
})
