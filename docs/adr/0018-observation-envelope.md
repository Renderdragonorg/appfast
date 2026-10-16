# ADR 0018: Observations share an envelope; payloads vary by kind

Status: accepted

## Context

Checks emit different things: frame timings, memory samples, INP interactions. A single rigid type would either flatten them or force everything into numbers. A free-form blob would be unrankable.

## Decision

Every observation shares a small envelope:

```ts
type Observation = {
  check: CheckName
  kind: string          // e.g. 'scrollSummary', 'worstFrame'
  tMs: number           // ms from the start of the check
  meta?: Record<string, unknown>
  payload: unknown      // shape defined per kind
}
```

The `kind` names the payload's shape. The envelope is uniform; the payload is not.

## Consequences

- The agent can iterate one list and switch on `kind`.
- Each check owns its payload types; the envelope stays fixed.
- `payload: unknown` in the public type is honest (the shape depends on `kind`), and per-check types can narrow it for callers who want them.
- Every new observation kind is a new payload contract to document.
