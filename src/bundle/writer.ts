import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Bundle } from '../types.js'

/**
 * Writes the bundle as `${outputDir}/bundle.json` (2-space JSON plus a trailing
 * newline), creating outputDir if needed. Normalizes every artifact path to
 * forward slashes. Never deletes anything, and does not add itself to
 * `bundle.artifacts` (ADR 0009).
 */
export async function writeBundle(bundle: Bundle, outputDir: string): Promise<void> {
  for (const artifact of bundle.artifacts) {
    artifact.path = artifact.path.replace(/\\/g, '/')
  }
  await mkdir(outputDir, { recursive: true })
  const json = `${JSON.stringify(bundle, null, 2)}\n`
  await writeFile(join(outputDir, 'bundle.json'), json, 'utf8')
}
