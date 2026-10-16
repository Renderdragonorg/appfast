# ADR 0015: Long-session check is opt-in

Status: accepted

## Context

The long-session leak check runs for minutes of interaction. Inside every repeat it dominates the audit's cost. The default check set was all four.

## Decision

The long-session check is not in the default set. It runs only when `target.checks` asks for it. The default checks are the other three: throttled scroll jank, heavy-payload render, interaction storm.

## Consequences

- A bare `audit({ url })` stays reasonably fast.
- Leak detection is a deliberate, slower request, not something that surprises a caller with a multi-minute run.
- Long-session implicitly runs once, not N times, since opting in is already expensive. If repeated leaks are ever wanted, that's a deliberate addition.
- The default set is now three checks. Docs and the `CheckName` union must reflect that.
