export type CheckName = 'scrollJank' | 'heavyPayload' | 'interactionStorm' | 'longSession'

export type ThrottleProfile =
  | 'mobile'
  | 'desktop'
  | {
      cpuSlowdown: number
      downloadKbps: number
      uploadKbps: number
      latencyMs: number
    }

export interface Viewport {
  width: number
  height: number
  deviceScaleFactor?: number
  isMobile?: boolean
}

export interface Cookie {
  name: string
  value: string
  domain: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface Credentials {
  headers?: Record<string, string>
  cookies?: Cookie[]
}

export interface Target {
  url: string
  runs?: number
  throttle?: ThrottleProfile
  viewport?: Viewport
  headers?: Record<string, string>
  cookies?: Cookie[]
  checks?: CheckName[]
  outputDir?: string
  refreshAuth?: () => Promise<Credentials>
}

export interface ResolvedTarget {
  url: string
  runs: number
  throttle: ThrottleProfile
  viewport: Viewport
  headers: Record<string, string>
  cookies: Cookie[]
  checks: CheckName[]
  outputDir: string
  detailRows: number
  refreshAuth?: () => Promise<Credentials>
}

export type MetricName = 'lcp' | 'cls' | 'tbt' | 'ttfb' | 'fcp' | 'speedIndex'

export interface MetricThresholds {
  good: number
  needsImprovement: number
  direction: 'lowerIsBetter'
}

export interface Metric {
  name: MetricName
  unit: 'ms' | 'unitless'
  median: number
  min: number
  max: number
  runs: number
  values: number[]
  thresholds?: MetricThresholds
}

export interface Observation {
  check: CheckName
  kind: string
  tMs: number
  repeat: number
  warm: boolean
  meta?: Record<string, unknown>
  payload: unknown
}

export type ArtifactKind = 'lighthouseJson' | 'trace' | 'screenshot' | 'har' | 'console'

export interface Artifact {
  kind: ArtifactKind
  path: string
  bytes: number
  mimeType: string
}

export interface Bundle {
  bundleVersion: 1
  engineVersion: string
  target: {
    url: string
    runs: number
    throttle: ThrottleProfile
    checks: CheckName[]
  }
  startedAt: string
  durationMs: number
  metrics: Metric[]
  observations: Observation[]
  artifacts: Artifact[]
  caveats: string[]
}
