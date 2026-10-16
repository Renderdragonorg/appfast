import type { Bundle } from '../types.js'

/**
 * Writes the bundle JSON and its artifact files into outputDir. Creates
 * outputDir if needed, never deletes anything (ADR 0009). Adds the
 * `bundle.json` artifact to the bundle before writing.
 *
 * Owner: bundle thread.
 */
export async function writeBundle(bundle: Bundle, outputDir: string): Promise<void> {
  void bundle
  void outputDir
  throw new Error('writeBundle not implemented')
}
