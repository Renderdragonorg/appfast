<img src="assets/icon.svg" width="64" height="64" alt="">

# RenderDragon

A web performance audit library. It loads a page in a real browser, runs Lighthouse plus a set of synthetic checks, and returns an evidence bundle describing what it observed. It does not score, rank, or recommend. A downstream agent reads the bundle and decides what matters.

Status: early. The public types and the `audit()` orchestration are in place; the Lighthouse path, the browser driver, and the checks are being implemented.

## Install

```
npm install renderdragon
```

## Usage

```ts
import { audit } from 'renderdragon'

const bundle = await audit({ url: 'https://example.com' })
console.log(bundle.metrics)       // lcp, cls, tbt, ttfb, fcp, speedIndex with spread
console.log(bundle.observations)  // scroll jank, heavy payload, interaction storm
```

Pass configuration in the target:

```ts
await audit({
  url: 'https://example.com',
  runs: 3,                    // default 1; more runs give a real median and spread
  throttle: 'desktop',        // default 'mobile' (4x CPU, Slow 4G)
  checks: ['scrollJank'],     // default scrollJank, heavyPayload, interactionStorm
  headers: { Authorization: 'Bearer ...' },
  cookies: [{ name: 'session', value: '...', domain: 'example.com' }],
  outputDir: './audit-out',   // default a temp dir; you own cleanup
  refreshAuth: async () => ({ headers: { Authorization: 'Bearer new' } }),
})
```

## What you get

`audit()` resolves to a `Bundle` with a stable shape:

- `metrics`: the curated core set (`lcp`, `cls`, `tbt`, `ttfb`, `fcp`, `speedIndex`), each with median, min, max, the raw per-run values, and threshold context. No rating.
- `observations`: neutral, event-shaped facts from the checks, each with a `check`, a `kind`, and a payload.
- `artifacts`: paths to the raw Lighthouse report, traces, and screenshots, relative to `outputDir`.
- `bundleVersion` and `engineVersion`, so a reader knows which shape it is reading and which build produced it.

## Checks

The default set runs on a shared, warmed browser:

- `scrollJank`: scrolls the loaded page under throttling and records frame timing.
- `heavyPayload`: measures render and interaction cost under a large DOM, many images, and a lot of data.
- `interactionStorm`: drives rapid input and route changes and measures INP under stress.

`longSession` (memory and DOM growth over minutes) is opt-in, since it is the slow one.

## Design

The decisions behind the shape live in [docs/adr](docs/adr), with a glossary in [docs/glossary.md](docs/glossary.md) and a full spec in [docs/spec.md](docs/spec.md). Read the spec before changing the interface.

## Development

```
npm install
npm run typecheck
npm test
```

Browser-dependent tests need Chrome. This repo does not vendor one; set `RENDERDRAGON_CHROME_PATH` to a Chrome binary to run them, otherwise those tests skip.
