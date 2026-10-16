# ADR 0005: Split result model (metrics and observations)

Status: accepted

## Context

Two kinds of data come out of a run. Lighthouse emits scalar lab metrics (LCP, CLS, TBT, TTFB, and friends). The four custom checks emit structured, event-shaped data: jank events, memory timelines, INP samples under load. A single Observation type would flatten a real difference in shape.

## Decision

The evidence bundle has two sections:
- `metrics`: standard scalar lab numbers, each with its value and threshold context.
- `observations`: structured output from the custom checks, event-shaped and source-tagged.

Both are neutral. Neither carries severity or a verdict.

## Consequences

- The agent reads two clearly different things instead of guessing at a union.
- Thresholds live in `metrics` as context, never as pass/fail.
- Adding a check means adding to `observations`; adding a lab metric means adding to `metrics`. The two evolve independently.
- The distinction is a contract, so a metric never quietly becomes an observation or vice versa.
