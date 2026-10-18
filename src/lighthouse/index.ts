import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import type { Flags, Result as LighthouseResult, ScreenEmulationSettings, ThrottlingSettings } from 'lighthouse'
import { AppFastError } from '../errors.js'
import type { Artifact, MetricName, ResolvedTarget } from '../types.js'

/** One raw metric reading from a single Lighthouse cold load. */
export interface RawMetricSample {
  name: MetricName
  value: number
}

export interface LighthouseRunResult {
  samples: RawMetricSample[]
  artifacts: Artifact[]
}

export interface LighthouseInput {
  target: ResolvedTarget
  repeat: number
}

type ColdChrome = Awaited<ReturnType<typeof launch>>

const METRIC_AUDIT_IDS: ReadonlyArray<readonly [MetricName, string]> = [
  ['lcp', 'largest-contentful-paint'],
  ['cls', 'cumulative-layout-shift'],
  ['tbt', 'total-blocking-time'],
  ['ttfb', 'server-response-time'],
  ['fcp', 'first-contentful-paint'],
  ['speedIndex', 'speed-index'],
]

const MOBILE_SLOW_4G: ThrottlingSettings = {
  rttMs: 150,
  throughputKbps: 1.6 * 1024,
  cpuSlowdownMultiplier: 4,
}

const DESKTOP_DENSE_4G: ThrottlingSettings = {
  rttMs: 40,
  throughputKbps: 10 * 1024,
  cpuSlowdownMultiplier: 1,
}

function formFactorFor(target: ResolvedTarget): 'mobile' | 'desktop' {
  if (target.throttle === 'desktop') return 'desktop'
  if (target.throttle === 'mobile') return 'mobile'
  return target.viewport.isMobile === false ? 'desktop' : 'mobile'
}

function screenEmulationFor(target: ResolvedTarget): ScreenEmulationSettings {
  return {
    width: target.viewport.width,
    height: target.viewport.height,
    deviceScaleFactor: target.viewport.deviceScaleFactor ?? 1,
    mobile: target.viewport.isMobile ?? false,
    disabled: false,
  }
}

function throttlingFor(target: ResolvedTarget): {
  throttlingMethod: NonNullable<Flags['throttlingMethod']>
  throttling: ThrottlingSettings
} {
  const throttle = target.throttle
  if (throttle === 'mobile') return { throttlingMethod: 'simulate', throttling: MOBILE_SLOW_4G }
  if (throttle === 'desktop') return { throttlingMethod: 'simulate', throttling: DESKTOP_DENSE_4G }
  return {
    throttlingMethod: 'devtools',
    throttling: {
      cpuSlowdownMultiplier: throttle.cpuSlowdown,
      downloadThroughputKbps: throttle.downloadKbps,
      uploadThroughputKbps: throttle.uploadKbps,
      requestLatencyMs: throttle.latencyMs,
    },
  }
}

function decodeDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const comma = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, comma)
  const mimeType = /data:([^;]+)/.exec(meta)?.[1] ?? 'application/octet-stream'
  const buffer = Buffer.from(dataUrl.slice(comma + 1), 'base64')
  return { mimeType, buffer }
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'bin'
}

async function launchColdChrome(): Promise<ColdChrome> {
  const chromePath = process.env.APPFAST_CHROME_PATH
  try {
    return await launch({
      chromeFlags: ['--headless=new'],
      ...(chromePath ? { chromePath } : {}),
    })
  } catch (error) {
    throw new AppFastError('BROWSER_LAUNCH', 'Failed to launch a cold Chrome for the Lighthouse run', {
      cause: error,
    })
  }
}

/** Extracts the curated core metrics from a Lighthouse report as raw samples. */
export function extractMetricSamples(lhr: LighthouseResult): RawMetricSample[] {
  const samples: RawMetricSample[] = []
  for (const [name, auditId] of METRIC_AUDIT_IDS) {
    const value = lhr.audits[auditId]?.numericValue
    if (value === undefined || value === null || Number.isNaN(value)) continue
    samples.push({ name, value })
  }
  return samples
}

/**
 * Runs Lighthouse once against a cold browser and returns raw per-run metric
 * samples plus artifact references. The orchestrator aggregates samples across
 * repeats into medians and spreads.
 */
export async function runLighthouseCold(input: LighthouseInput): Promise<LighthouseRunResult> {
  const { target, repeat } = input
  const chrome = await launchColdChrome()

  try {
    const result = await lighthouse(target.url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'silent',
      formFactor: formFactorFor(target),
      screenEmulation: screenEmulationFor(target),
      ...throttlingFor(target),
    })

    const lhr = result?.lhr
    if (!lhr) {
      throw new AppFastError('LIGHTHOUSE', `Lighthouse returned no report for ${target.url}`)
    }
    if (lhr.runtimeError) {
      throw new AppFastError('LIGHTHOUSE', lhr.runtimeError.message, { cause: lhr.runtimeError })
    }

    const runDir = join(target.outputDir, `run-${repeat}`)
    await mkdir(runDir, { recursive: true })

    const artifacts: Artifact[] = []

    const lighthouseJson = JSON.stringify(lhr)
    const lighthousePath = `run-${repeat}/lighthouse.json`
    await writeFile(join(target.outputDir, lighthousePath), lighthouseJson)
    artifacts.push({
      kind: 'lighthouseJson',
      path: lighthousePath,
      bytes: Buffer.byteLength(lighthouseJson),
      mimeType: 'application/json',
    })

    const screenshotData = lhr.fullPageScreenshot?.screenshot?.data
    if (screenshotData) {
      const { mimeType, buffer } = decodeDataUrl(screenshotData)
      const filename = `screenshot.${extensionForMime(mimeType)}`
      const screenshotPath = `run-${repeat}/${filename}`
      await writeFile(join(target.outputDir, screenshotPath), buffer)
      artifacts.push({ kind: 'screenshot', path: screenshotPath, bytes: buffer.length, mimeType })
    }

    return { samples: extractMetricSamples(lhr), artifacts }
  } catch (error) {
    if (error instanceof AppFastError) throw error
    throw new AppFastError('LIGHTHOUSE', `Lighthouse run failed for ${target.url}`, { cause: error })
  } finally {
    await chrome.kill()
  }
}
