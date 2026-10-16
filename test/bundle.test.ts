import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeBundle } from '../src/bundle/writer.js'
import type { Bundle } from '../src/types.js'

const tempDirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'renderdragon-bundle-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      import('node:fs/promises').then(({ rm }) => rm(dir, { recursive: true, force: true })),
    ),
  )
})

function makeBundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    bundleVersion: 1,
    engineVersion: '0.0.1',
    target: {
      url: 'https://example.com',
      runs: 1,
      throttle: 'mobile',
      checks: ['scrollJank'],
    },
    startedAt: '2026-10-16T09:00:00.000Z',
    durationMs: 1000,
    metrics: [],
    observations: [],
    artifacts: [],
    caveats: [],
    ...overrides,
  }
}

describe('writeBundle', () => {
  it('creates a nested outputDir and writes bundle.json as 2-space JSON with a trailing newline', async () => {
    const root = await tempDir()
    const outputDir = join(root, 'nested', 'deeper')
    const bundle = makeBundle({ artifacts: [{ kind: 'screenshot', path: 'run-0/a.png', bytes: 1, mimeType: 'image/png' }] })

    await writeBundle(bundle, outputDir)

    const raw = await readFile(join(outputDir, 'bundle.json'), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    const parsed = JSON.parse(raw)
    expect(parsed.bundleVersion).toBe(1)
    expect(parsed.artifacts).toEqual([{ kind: 'screenshot', path: 'run-0/a.png', bytes: 1, mimeType: 'image/png' }])
    // 2-space indent is observable as an indented non-empty nested object.
    expect(raw).toContain('\n  "target":')
  })

  it('normalizes every artifact path to forward slashes', async () => {
    const outputDir = await tempDir()
    const bundle = makeBundle({
      artifacts: [
        { kind: 'trace', path: 'run-0\\trace.json', bytes: 2, mimeType: 'application/json' },
        { kind: 'har', path: 'run-1\\deep\\page.har', bytes: 3, mimeType: 'application/json' },
      ],
    })

    await writeBundle(bundle, outputDir)

    const parsed = JSON.parse(await readFile(join(outputDir, 'bundle.json'), 'utf8'))
    expect(parsed.artifacts[0].path).toBe('run-0/trace.json')
    expect(parsed.artifacts[1].path).toBe('run-1/deep/page.har')
    // The passed-in bundle is normalized in place too.
    expect(bundle.artifacts[0]!.path).toBe('run-0/trace.json')
  })

  it('does not delete pre-existing files in outputDir', async () => {
    const outputDir = await tempDir()
    await writeFile(join(outputDir, 'keep-me.txt'), 'do not touch')

    await writeBundle(makeBundle(), outputDir)

    const entries = await readdir(outputDir)
    expect(entries).toContain('keep-me.txt')
    expect(entries).toContain('bundle.json')
  })

  it('does not add bundle.json to bundle.artifacts', async () => {
    const outputDir = await tempDir()
    const bundle = makeBundle({ artifacts: [{ kind: 'console', path: 'run-0/console.log', bytes: 4, mimeType: 'text/plain' }] })

    await writeBundle(bundle, outputDir)

    const parsed = JSON.parse(await readFile(join(outputDir, 'bundle.json'), 'utf8'))
    expect(parsed.artifacts).toHaveLength(1)
    expect(parsed.artifacts[0].path).not.toContain('bundle.json')
  })

  it('returns void', async () => {
    const outputDir = await tempDir()
    await expect(writeBundle(makeBundle(), outputDir)).resolves.toBeUndefined()
  })
})
