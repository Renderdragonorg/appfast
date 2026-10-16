export interface ReasonRequest {
  system: string
  user: string
}

/**
 * A text-in, text-out model call. The engine ships no model; adapters or callers
 * provide one. Kept deliberately tiny so any provider can satisfy it.
 */
export interface Reasoner {
  /** Identifies the model in the returned analysis, e.g. "openai:gpt-4o-mini". */
  label: string
  complete(request: ReasonRequest): Promise<string>
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface EvidenceRef {
  kind: 'observation' | 'metric'
  /** An Observation id, or a Metric name. */
  ref: string
}

export interface Finding {
  id: string
  severity: Severity
  title: string
  rationale: string
  evidence: EvidenceRef[]
  recommendation?: string
}

export interface Analysis {
  summary: string
  findings: Finding[]
  analyzedAt: string
  /** The reasoner label that produced this analysis. */
  reasoner: string
}

export interface AnalyzeOptions {
  /** Maximum characters of digest sent to the model. Default 16000. */
  maxDigestChars?: number
  /** How many times to ask the model to fix invalid output. Default 1. */
  validationRetries?: number
}
