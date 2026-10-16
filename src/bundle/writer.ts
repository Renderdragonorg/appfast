import type { Bundle } from '../types.js'

/**
 * Writes the bundle JSON into outputDir. Creates outputDir if needed, never
 * deletes anything (ADR 0009). Normalizes artifact paths to forward slashes and
 * writes `bundle.json` at the root of outputDir. Does not add itself to
 * `bundle.artifacts`.
 *
 * Owner: bundle/auth thread.
 */
export async function writeBundle(bundle: Bundle, outputDir: string): Promise<void> {
  void bundle
  void outputDir
  throw new Error('writeBundle not implemented')
}
