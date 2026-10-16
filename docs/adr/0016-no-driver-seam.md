# ADR 0016: No formal browser seam; two concrete paths

Status: accepted

## Context

ADR 0011 left two browser paths: Lighthouse's cold browser and the checks' shared one. Two adapters usually argue for a seam. But a seam is only real when the things on either side are interchangeable across it, and these two are not: one produces a Lighthouse report, the other drives interactive sessions. They share "a browser" the way a hammer and a wrench share "a tool."

## Decision

No `BrowserDriver` interface. The Lighthouse path and the check path are two concrete internal modules. No abstraction is introduced until a third, genuinely interchangeable implementation appears.

## Consequences

- No speculative indirection. The code says what it does.
- The browser dependency isn't mockable behind an interface, so tests for these modules use a real browser or a recorded fixture, not a fake driver.
- If a third driver ever shows up (a remote grid, a different automation library), revisit and introduce the interface then, with two real cases already in hand.
- Locality stays: each path owns its own lifecycle without a shared abstraction papering over the differences.
