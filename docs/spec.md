# AppFast spec

Status: draft. Built from the ADRs in `docs/adr/`. Where this file and an ADR disagree, the ADR wins.

AppFast is a Renderdragon performance audit engine written in TypeScript. It audits a web page and returns an evidence bundle. It runs Lighthouse plus a set of custom synthetic checks, reports neutral facts, and stops. It does not score, rank, recommend, or call a model. A downstream agent reads the bundle and decides what matters.

## Public interface

One function.

```ts
import { audit } from 'appfast'

const bundle = await audit({ url: 'https://example.com' })
```

```ts
function audit(target: Target): Promise<Bundle>

type Target = {
  url: string
  runs?: number              // default 1
  throttle?: ThrottleProfile // default 'mobile'
  viewport?: Viewport        // default: throttle profile's viewport
  headers?: Record<string, string>
  cookies?: Cookie[]
  checks?: CheckName[]       // default: scrollJank, heavyPayload, interactionStorm
  outputDir?: string         // default: a temp dir
  refreshAuth?: () => Promise<Credentials>
}

type ThrottleProfile =
  | 'mobile'                 // 4x CPU slowdown, Slow 4G, mobile viewport
  | 'desktop'                // no throttling, 1350x940
  | { cpuSlowdown: number; downloadKbps: number; uploadKbps: number; latencyMs: number }

type Viewport = {
  width: number
  height: number
  deviceScaleFactor?: number
  isMobile?: boolean
}

type Cookie = {
  name: string
  value: string
  domain: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

type Credentials = {
  headers?: Record<string, string>
  cookies?: Cookie[]
}

type CheckName = 'scrollJank' | 'heavyPayload' | 'interactionStorm' | 'longSession'
```

The bare call `audit({ url })` runs Lighthouse once at the mobile preset plus the three default checks, and writes artifacts to a temp directory.

## What a run does

An audit uses two browsers (ADR 0011). Lighthouse launches its own Chrome per run so every measurement is a cold load. The checks share a second Chrome that persists across repeats and warms up (ADR 0014).

Each repeat is one unit (ADR 0012):

1. Lighthouse cold load on its own browser, producing metrics.
2. Navigate the check browser to the same URL.
3. Run the selected checks against the loaded page, collecting observations.

Repeat the unit `runs` times. Metrics carry the median and spread across repeats; observations carry a repeat index and a warmth flag.

```
for i in 0..runs:
  metrics[i]  = lighthouseColdLoad(target)        # own browser, cold
  page        = checkBrowser.navigate(target.url) # shared browser, warming
  for check in target.checks:
    observations += check.run(page, { repeat: i, warm: i > 0 })
  teardown
```

## Metrics

`metrics` holds a curated core set of scalar lab numbers (ADR 0010), each with per-run values, the median, and the spread. Metrics carry threshold context but no rating and no verdict (ADR 0003).

```ts
type Metric = {
  name: MetricName
  unit: 'ms' | 'unitless'
  median: number
  min: number
  max: number
  runs: number
  values: number[]           // raw value per repeat, in order
  thresholds?: { good: number; needsImprovement: number; direction: 'lowerIsBetter' }
}

type MetricName = 'lcp' | 'cls' | 'tbt' | 'ttfb' | 'fcp' | 'speedIndex'
```

Core thresholds, present as context only:

| Metric | good | needs improvement | unit |
|---|---|---|---|
| lcp | 2500 | 4000 | ms |
| cls | 0.1 | 0.25 | unitless |
| tbt | 200 | 600 | ms |
| ttfb | 800 | 1800 | ms |
| fcp | 1800 | 3000 | ms |
| speedIndex | 3400 | 5800 | ms |

The full Lighthouse report is written to an artifact (`lighthouseJson`) and referenced by path. Anything outside the core set lives there.

## Observations

Checks emit observations. Every observation shares one envelope; the payload varies by `kind` (ADR 0018).

```ts
type Observation = {
  id: string                // assigned by the orchestrator: `${check}-${repeat}-${index}`
  check: CheckName
  kind: string              // names the payload shape
  tMs: number               // ms from the start of this check
  repeat: number            // which run produced it
  warm: boolean             // false on repeat 0, true after
  meta?: Record<string, unknown>
  payload: unknown
}
```

Checks produce an `ObservationDraft` (the same shape without `id`); the orchestrator assigns `id`. The id is stable within a bundle and is what a finding cites (ADR 0022).

Each check emits one `*Summary` observation with the complete aggregates, plus a capped list of worst-offender observations (ADR 0019). The cap is `detailRows`, default 20.

### scrollJank

Scrolls the loaded page under the run's throttle and records frame timing.

`kind: 'scrollSummary'`

```ts
{
  durationMs: number
  scrollDistancePx: number
  frames: number
  droppedFrames: number
  droppedFrameRatio: number     // 0..1
  p95FrameMs: number
  worstFrameMs: number
  longTaskCount: number
  totalLongTaskMs: number
  jankTimeMs: number            // total time over the frame budget
}
```

`kind: 'worstFrame'` (up to `detailRows`)

```ts
{ frameMs: number; budgetMs: number; scrollYAtFrame: number }
```

`kind: 'worstLongTask'` (up to `detailRows`)

```ts
{ durationMs: number; attribution?: string }
```

### heavyPayload

Loads the page and measures cost under a large DOM, many images, and a lot of data.

`kind: 'heavyPayloadSummary'`

```ts
{
  domNodes: number
  images: number
  imageBytes: number
  layoutMs: number
  scriptMs: number
  firstRenderMs: number
  forcedReflows: number
}
```

`kind: 'worstLayoutTask'` (up to `detailRows`)

```ts
{ durationMs: number; attribution?: string }
```

### interactionStorm

Drives rapid clicks, typing, and route changes and measures INP under stress.

`kind: 'interactionStormSummary'`

```ts
{
  interactions: number
  inpMs: number
  p95InpMs: number
  worstInpMs: number
  droppedInteractions: number
}
```

`kind: 'worstInteraction'` (up to `detailRows`)

```ts
{ kind: 'click' | 'key' | 'route'; target: string; inpMs: number }
```

### longSession (opt-in)

Interacts for minutes and watches for leaks. Not in the default set (ADR 0015).

`kind: 'longSessionSummary'`

```ts
{
  durationMs: number
  interactions: number
  startMemoryMb: number
  endMemoryMb: number
  memoryGrowthMb: number
  startDomNodes: number
  endDomNodes: number
  domGrowth: number
  longTaskCount: number
  monotonicGrowth: boolean      // memory rose steadily rather than sawtoothing
}
```

## Artifacts

Artifacts are files. The bundle carries paths (ADR 0009). The engine writes into `target.outputDir` (or a temp dir) and never deletes anything; the caller owns cleanup.

```ts
type Artifact = {
  kind: 'lighthouseJson' | 'trace' | 'screenshot' | 'har' | 'console'
  path: string         // relative to outputDir
  bytes: number
  mimeType: string
}
```

Directory layout, one folder per repeat:

```
<outputDir>/
  run-0/
    lighthouse.json
    trace.json
    screenshot.webp
    console.log
```

Paths in the bundle are relative to `outputDir` and forward-slashed. The screenshot extension follows its mime type; Lighthouse emits webp for the full-page screenshot.

## Bundle

```ts
type Bundle = {
  bundleVersion: 1
  engineVersion: string
  target: {
    url: string
    runs: number
    throttle: ThrottleProfile
    checks: CheckName[]
  }
  startedAt: string            // ISO 8601
  durationMs: number
  metrics: Metric[]
  observations: Observation[]
  artifacts: Artifact[]
  caveats: string[]            // e.g. warm repeats, auth retry, missing raw report
}
```

`bundleVersion` is the shape; bump it only on a breaking change. `engineVersion` is the build that produced the bundle (ADR 0017).

## Defaults

| Setting | Default |
|---|---|
| runs | 1 |
| throttle | `'mobile'` (4x CPU, Slow 4G) |
| checks | scrollJank, heavyPayload, interactionStorm |
| detailRows | 20 |
| outputDir | a temp directory |
| auth | none |

## Failure modes

The engine fails the run, it does not silently measure the wrong thing.

- Auth expiry. On a detected logout (login redirect, missing session cookie, or a caller-supplied signal), the engine calls `refreshAuth`, applies the result, and retries once. If still logged out, the run fails (ADR 0020).
- Browser launch failure. Fail the run with the browser error. No partial bundle.
- Navigation failure (DNS, TLS, non-2xx). Fail the run with the status and URL.
- Lighthouse failure. Fail the run; include Lighthouse's error.
- A single check throwing. Fail the run. Partial observations from other checks are discarded, since a partial bundle misleads the agent.

## Worked example

```json
{
  "bundleVersion": 1,
  "engineVersion": "0.0.1",
  "target": {
    "url": "https://example.com",
    "runs": 1,
    "throttle": "mobile",
    "checks": ["scrollJank", "heavyPayload", "interactionStorm"]
  },
  "startedAt": "2026-10-16T09:00:00.000Z",
  "durationMs": 48210,
  "metrics": [
    {
      "name": "lcp",
      "unit": "ms",
      "median": 3120,
      "min": 3120,
      "max": 3120,
      "runs": 1,
      "values": [3120],
      "thresholds": { "good": 2500, "needsImprovement": 4000, "direction": "lowerIsBetter" }
    },
    {
      "name": "cls",
      "unit": "unitless",
      "median": 0.04,
      "min": 0.04,
      "max": 0.04,
      "runs": 1,
      "values": [0.04],
      "thresholds": { "good": 0.1, "needsImprovement": 0.25, "direction": "lowerIsBetter" }
    }
  ],
  "observations": [
    {
      "check": "scrollJank",
      "kind": "scrollSummary",
      "tMs": 0,
      "repeat": 0,
      "warm": false,
      "payload": {
        "durationMs": 6000,
        "scrollDistancePx": 12000,
        "frames": 360,
        "droppedFrames": 41,
        "droppedFrameRatio": 0.114,
        "p95FrameMs": 34.2,
        "worstFrameMs": 118.7,
        "longTaskCount": 6,
        "totalLongTaskMs": 512.3,
        "jankTimeMs": 430.1
      }
    },
    {
      "check": "scrollJank",
      "kind": "worstFrame",
      "tMs": 2210,
      "repeat": 0,
      "warm": false,
      "payload": { "frameMs": 118.7, "budgetMs": 16.7, "scrollYAtFrame": 4300 }
    }
  ],
  "artifacts": [
    { "kind": "lighthouseJson", "path": "run-0/lighthouse.json", "bytes": 812344, "mimeType": "application/json" },
    { "kind": "trace", "path": "run-0/trace.json", "bytes": 24110992, "mimeType": "application/json" },
    { "kind": "screenshot", "path": "run-0/screenshot.webp", "bytes": 184223, "mimeType": "image/webp" }
  ],
  "caveats": []
}
```

## Analysis (companion)

`analyze` is a separate entry from the engine, `appfast/analyze` (ADR 0021). The engine holds no model; `analyze` takes one from the caller.

```ts
import { analyze, createAnthropicReasoner } from 'appfast/analyze'

const analysis = await analyze(bundle, createAnthropicReasoner({ model: 'claude-3-5-sonnet-latest' }))
```

```ts
interface Reasoner {
  label: string
  complete(request: { system: string; user: string }): Promise<string>
}

function analyze(bundle: Bundle, reasoner: Reasoner, options?: AnalyzeOptions): Promise<Analysis>

interface AnalyzeOptions {
  maxDigestChars?: number      // default 16000
  validationRetries?: number   // default 1
}

interface Analysis {
  summary: string
  findings: Finding[]
  analyzedAt: string           // ISO 8601
  reasoner: string             // the reasoner's label, e.g. "anthropic:claude-3-5-sonnet-latest"
}

interface Finding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  rationale: string
  evidence: EvidenceRef[]
  recommendation?: string
}

interface EvidenceRef {
  kind: 'observation' | 'metric'
  ref: string                  // an Observation id, or a Metric name
}
```

`analyze` sends the bundle as a digest (metrics with thresholds, observations with their ids, artifact paths, caveats), asks the reasoner for JSON of the `Analysis` shape, and validates it. Evidence references that do not resolve in the bundle are dropped. Invalid output gets one repair retry, then a `AppFastError` with code `ANALYSIS`.

Shipped adapters: `createOpenAiReasoner` and `createAnthropicReasoner`, implemented with `fetch` (no SDK dependency), plus `createOpenCodeReasoner`. The first two read their key from an option or from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. The OpenAI adapter also takes a `baseUrl` or `OPENAI_BASE_URL`, so any server with a compatible `/chat/completions` endpoint works. The OpenCode adapter spawns `opencode2 run --format json` and uses the caller's existing OpenCode login, so it needs no key (ADR 0024).

## CLI

A thin `appfast` binary wraps both entries (ADR 0023): `audit <url>` calls the engine and writes a bundle, `analyze <bundle.json>` calls the companion. It adds no logic beyond argument parsing and printing, and `--json` makes both commands scriptable. `analyze --provider opencode` runs the model through OpenCode instead of a provider key, and `analyze --provider openai-compatible --base-url <url>` points the OpenAI adapter at a compatible endpoint.

## Non-goals

- No score, rating, or verdict from the engine. The engine records facts; judging happens in the separate `analyze` companion, which the caller supplies a model to (ADR 0003, ADR 0021).
- No LLM inside the engine. `analyze` is a separate entry and takes a reasoner from the caller (ADR 0004, ADR 0021).
- No field data. This is lab only; CrUX is out because most personal-project origins don't qualify (ADR 0001 context).
- No scripted login or multi-step journeys. Auth is an injected session plus a refresh callback.
- No server or dashboard. A thin CLI ships as a wrapper over the two entries (ADR 0023); the library is still the product.
- No browser driver interface. The two browser paths stay concrete (ADR 0016).
