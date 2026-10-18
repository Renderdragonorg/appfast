<img src="assets/banner.png" alt="AppFast, a Renderdragon performance audit engine">

# AppFast

AppFast is a Renderdragon performance audit engine. It loads a page in a real browser, runs Lighthouse and three synthetic checks, and writes a JSON evidence bundle. The bundle holds numbers and events, not scores or advice.

A second entry, `appfast/analyze`, reads a bundle and returns ranked findings. You give it a model: an OpenAI key, an Anthropic key, or a model already signed in to OpenCode V2.

Status: working. The engine, checks, analysis entry, and CLI run end to end. Browser-dependent tests need Chrome.

## Install

```
npm install appfast
```

## Usage

```ts
import { audit } from 'appfast'

const bundle = await audit({ url: 'https://example.com' })
console.log(bundle.metrics)       // lcp, cls, tbt, ttfb, fcp, speedIndex with spread
console.log(bundle.observations)  // scroll jank, heavy payload, interaction storm
```

Configure the target when the defaults are wrong:

```ts
await audit({
  url: 'https://example.com',
  runs: 3,                    // default 1
  throttle: 'desktop',        // default 'mobile' (4x CPU, Slow 4G)
  checks: ['scrollJank'],     // default scrollJank, heavyPayload, interactionStorm
  headers: { Authorization: 'Bearer ...' },
  cookies: [{ name: 'session', value: '...', domain: 'example.com' }],
  outputDir: './audit-out',   // default a temp dir; you own cleanup
  refreshAuth: async () => ({ headers: { Authorization: 'Bearer new' } }),
})
```

One repeat is one Lighthouse cold load on its own Chrome, then a navigation in a shared, warmed check browser. The checks run there. With `runs: 3` you get three of those, and each metric carries a median, min, max, and the raw values.

## What you get

- `metrics`: six lab numbers, each with median, min, max, per-run values, and threshold context. No rating.
- `observations`: neutral events from the checks, each with an `id`, a `check`, a `kind`, and a payload. An `id` is what a finding cites.
- `artifacts`: paths to the Lighthouse report, traces, and screenshots, relative to `outputDir`.
- `bundleVersion`, `engineVersion`, and `caveats`, so a reader knows which shape it has and what went wrong during the run.

## Checks

The default set runs on the shared browser:

- `scrollJank` scrolls the page under throttling and records frame timing.
- `heavyPayload` measures render and interaction cost under a large DOM, many images, and a lot of data.
- `interactionStorm` drives rapid input and route changes and measures INP under stress.

`longSession` (memory and DOM growth over minutes) is opt-in because it is slow.

## Judging a bundle

```ts
import { analyze, createAnthropicReasoner } from 'appfast/analyze'

const analysis = await analyze(bundle, createAnthropicReasoner({ model: 'claude-3-5-sonnet-latest' }))
analysis.findings // ranked, each with severity, rationale, and evidence references
```

OpenAI and Anthropic adapters ship with the package and read `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` unless you pass a key. The analyzer checks model output before returning it: unknown evidence references are dropped, and invalid JSON gets one repair retry.

### OpenAI-compatible endpoints

The OpenAI adapter takes a base URL, so it also works with OpenRouter, Together, vLLM, LM Studio, Ollama, and any server that implements `POST /chat/completions`:

```
OPENAI_API_KEY=... appfast analyze ./audit/bundle.json --provider openai-compatible --base-url https://openrouter.ai/api/v1 --model openai/gpt-4o-mini
```

Set `OPENAI_BASE_URL` instead of `--base-url` if you use one endpoint often. The key still comes from `OPENAI_API_KEY`; local servers that ignore auth accept any non-empty value. In code, pass `baseUrl` to `createOpenAiReasoner`.

```ts
createOpenAiReasoner({
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.1',
  apiKey: 'ollama',
})
```

## Running analysis through OpenCode

If OpenCode V2 is already signed in, you can skip provider keys:

```
appfast analyze ./audit/bundle.json --provider opencode --model opencode-go/glm-5.3-flash
```

```ts
import { analyze, createOpenCodeReasoner } from 'appfast/analyze'

const analysis = await analyze(bundle, createOpenCodeReasoner({ model: 'opencode-go/glm-5.3-flash' }))
```

The adapter spawns `opencode2 run --format json` and reads the text events. Any model from `opencode models` works, and `opencode-go/glm-5.3-flash` is the default. Each call runs in a throwaway directory with an agent that denies every tool permission, so a bundle that contains instructions cannot edit files or run commands. Pass `command: 'opencode'` if your binary uses the standard name.

## Command line

The package ships one binary over both entries:

```
appfast audit https://example.com --out ./audit
appfast analyze ./audit/bundle.json --provider opencode --model opencode-go/glm-5.3-flash
```

`audit` writes the bundle and prints a metric summary. `analyze` infers the provider from environment keys unless `--provider` is set. `--json` makes either command print machine-readable output.

## Limits

This is lab data. It does not include field measurements, real users, or scripted multi-step journeys. A single run is noisy, so use `runs: 3` or more before trusting a small difference. Model output varies between calls; the bundle is the reproducible part.

## Design

The decisions behind the shape live in [docs/adr](docs/adr), with a glossary in [docs/glossary.md](docs/glossary.md) and the full spec in [docs/spec.md](docs/spec.md). Read the spec before changing the interface.

## Development

```
npm install
npm run typecheck
npm test
```

Browser tests need Chrome. The repo does not vendor one. Set `APPFAST_CHROME_PATH` to a Chrome binary to run them; otherwise those tests skip.
