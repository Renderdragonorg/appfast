# ADR 0019: Checks report aggregates plus capped worst offenders

Status: accepted

## Context

A check can produce a full event stream (every frame, every memory sample). That's complete and also thousands of rows a reasoning agent won't read. The scroll-jank check, for example, could emit every frame time or just the summary.

## Decision

Each check emits complete aggregates (counts, percentiles, totals) plus a capped list of the worst offenders (top N slowest frames, long tasks, or interactions, with timestamps). Detail rows are capped per check.

## Consequences

- The agent gets the headline and the evidence behind it, without a huge list.
- The cap means truly pathological runs are summarized, not exhaustively listed. If every frame is bad, the worst 20 still tell the story, and the aggregate counts carry the scale.
- The cap is a constant that should be tunable if a real case needs more.
- Consistent with ADR 0009: if a full stream is ever needed, it goes to an artifact file, not the bundle.
