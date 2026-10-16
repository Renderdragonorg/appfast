# ADR 0007: Repeat runs, report median and spread

Status: accepted

## Context

Lighthouse is noisy between identical runs, and a browser under load is noisier. A single sample can't tell a real problem from an unlucky one. But repeating every run is slow and costly.

## Decision

A run repeats N times and reports the median plus a spread (min/max), not a single number. The engine always records the run count and the raw per-run values, whatever N is.

## Consequences

- The agent can see variance and decide whether a number is stable, instead of trusting one sample.
- The bundle carries more than a headline number: median, spread, N, and the raw values.
- Cost scales with N. A sensible default and an override are needed (see open questions).
- The spread policy for the custom checks (jank, memory) may differ from the metric policy, since some checks are stateful across a session.
- The default is N=1 for speed. The repeat mechanism is always on; the default just makes it fast. At N=1 the spread is degenerate, so the bundle must say N=1 plainly rather than implying confidence it doesn't have.
