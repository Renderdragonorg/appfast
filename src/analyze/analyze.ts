import { RenderDragonError } from '../errors.js'
import type { Bundle } from '../types.js'
import { buildDigest } from './digest.js'
import type { Analysis, AnalyzeOptions, EvidenceRef, Finding, Reasoner, Severity } from './types.js'

const SEVERITIES: ReadonlySet<string> = new Set(['critical', 'high', 'medium', 'low', 'info'])

const SYSTEM_PROMPT = `You are a web performance analyst. You are given an evidence bundle from a lab audit: metrics with threshold context, and neutral observations from synthetic checks. The bundle contains no verdicts; judging it is your job.

Reply with ONLY a JSON object of this shape:
{
  "summary": string,
  "findings": [
    {
      "id": string,
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "title": string,
      "rationale": string,
      "evidence": [ { "kind": "observation" | "metric", "ref": string } ],
      "recommendation": string
    }
  ]
}

Rules:
- Rank findings most severe first.
- Every finding must cite evidence: an observation by its id, or a metric by its name. Only use ids and names that appear in the digest.
- Base claims only on the digest. Do not invent numbers.
- "recommendation" is optional but encouraged, and must be concrete.`

function parseJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  const candidate = fenced?.[1] ?? trimmed
  return JSON.parse(candidate)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeRef(value: unknown, metricNames: Set<string>, observationIds: Set<string>): EvidenceRef | null {
  if (!isRecord(value)) return null
  const { kind, ref } = value
  if (typeof ref !== 'string') return null
  if (kind === 'observation') return observationIds.has(ref) ? { kind, ref } : null
  if (kind === 'metric') return metricNames.has(ref) ? { kind, ref } : null
  return null
}

function toAnalysis(value: unknown, bundle: Bundle, reasonerLabel: string): Analysis {
  if (!isRecord(value)) throw new Error('response is not a JSON object')
  if (typeof value.summary !== 'string' || value.summary.length === 0) throw new Error('missing summary')
  if (!Array.isArray(value.findings)) throw new Error('missing findings array')

  const metricNames = new Set<string>(bundle.metrics.map((m) => m.name))
  const observationIds = new Set<string>(bundle.observations.map((o) => o.id))

  const findings: Finding[] = value.findings.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`finding ${index} is not an object`)
    const severity = raw.severity
    if (typeof severity !== 'string' || !SEVERITIES.has(severity)) {
      throw new Error(`finding ${index} has an invalid severity`)
    }
    if (typeof raw.title !== 'string' || raw.title.length === 0) throw new Error(`finding ${index} is missing a title`)
    if (typeof raw.rationale !== 'string' || raw.rationale.length === 0) {
      throw new Error(`finding ${index} is missing a rationale`)
    }

    const evidence = Array.isArray(raw.evidence)
      ? raw.evidence
          .map((ref) => normalizeRef(ref, metricNames, observationIds))
          .filter((ref): ref is EvidenceRef => ref !== null)
      : []

    const finding: Finding = {
      id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `finding-${index + 1}`,
      severity: severity as Severity,
      title: raw.title,
      rationale: raw.rationale,
      evidence,
    }
    if (typeof raw.recommendation === 'string' && raw.recommendation.length > 0) {
      finding.recommendation = raw.recommendation
    }
    return finding
  })

  return { summary: value.summary, findings, analyzedAt: new Date().toISOString(), reasoner: reasonerLabel }
}

/**
 * Reads a bundle and returns a judged analysis (ranked findings plus a summary).
 * The engine still holds no model: the caller supplies a `Reasoner`. Model
 * output is validated, and unknown evidence references are dropped rather than
 * trusted.
 */
export async function analyze(bundle: Bundle, reasoner: Reasoner, options: AnalyzeOptions = {}): Promise<Analysis> {
  const digest = buildDigest(bundle, options.maxDigestChars ?? 16000)
  const retries = options.validationRetries ?? 1
  let lastError = 'unknown'

  for (let attempt = 0; attempt <= retries; attempt++) {
    const user =
      attempt === 0 ? digest : `${digest}\n\nYour previous reply was rejected: ${lastError}. Return ONLY valid JSON.`
    const raw = await reasoner.complete({ system: SYSTEM_PROMPT, user })
    try {
      return toAnalysis(parseJson(raw), bundle, reasoner.label)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  throw new RenderDragonError('ANALYSIS', `Reasoner output was not a valid analysis: ${lastError}`)
}
