# ADR 0011: Two browsers. Lighthouse owns a cold one; checks share one.

Status: accepted. Supersedes the browser part of ADR 0006.

## Context

ADR 0006 chose a single shared browser for the whole run. Later, cold-load correctness surfaced: Lighthouse measures a fresh profile with an empty cache, and reusing one Chrome across repeats warms the cache, so run 2 is no longer a cold load. Sharing one browser and reporting true cold-load metrics are incompatible.

## Decision

An audit uses two browsers:
- Lighthouse launches its own Chrome per run, giving a genuine cold load.
- The custom checks share a separate Chrome that persists across repeats.

## Consequences

- Metrics stay cold-load true. Lighthouse keeps full control of its own environment.
- The check browser warms across repeats: cache, service workers, and JIT state carry over. Repeat 2 of a scroll test is not the same as repeat 1. This must be recorded in the bundle, not hidden.
- Two Chrome launches per audit, so cost and memory roughly double.
- There is now a real browser seam: two drivers with different lifecycles. Whether to formalize it as an interface is an open question, not a given.
