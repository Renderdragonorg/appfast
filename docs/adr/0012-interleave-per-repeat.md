# ADR 0012: Interleave metrics and checks per repeat

Status: accepted

## Context

With N repeats, a run could do all Lighthouse runs first and then the checks, or the reverse, or interleave. The choice decides whether the checks see the same page state the metrics were measured on, and whether both get spread across repeats.

## Decision

Each repeat runs as one unit: the Lighthouse cold load, then the checks against that same page. N repeats give N complete samples, so both metrics and check observations carry spread.

## Consequences

- Every sample is a full picture of one target at one moment.
- Spread is available for both metrics and checks, not just metrics.
- Runtime is longer per repeat since a check (long-session especially, which takes minutes) runs inside every repeat. With the default N=1 this is fine; raising N multiplies a slow check.
- The long-session check dominating the per-repeat cost is an open concern. It may need its own repeat policy.
