import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { audit } from '../src/index.js'
import { serveDir, type ServedSite } from './helpers/serve.js'

const hasChrome = Boolean(process.env.APPFAST_CHROME_PATH)
const siteDir = fileURLToPath(new URL('./fixtures/site', import.meta.url))

describe.skipIf(!hasChrome)('audit end to end (requires Chrome)', () => {
  let site: ServedSite

  beforeAll(async () => {
    site = await serveDir(siteDir)
  })

  afterAll(async () => {
    await site.close()
  })

  it('produces a bundle with metrics, observations, and artifacts', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rd-integration-'))
    const bundle = await audit({ url: site.url, outputDir, checks: ['scrollJank'] })

    expect(bundle.bundleVersion).toBe(1)
    expect(bundle.metrics.length).toBeGreaterThan(0)
    expect(bundle.observations.length).toBeGreaterThan(0)
    expect(bundle.artifacts.length).toBeGreaterThan(0)
  }, 180000)
})
