# ADR 0009: Artifacts by path, in a caller-owned output directory

Status: accepted

## Context

A trace is tens of MB. Screenshots, HAR files, and console logs add up. Embedding them in the bundle JSON makes it huge and unusable; keeping them as files keeps the bundle small but couples the agent to a filesystem.

## Decision

Artifacts are written to files. The bundle carries relative paths. The engine writes to `target.outputDir`, or a temp directory if none is given, and never deletes anything. The caller owns cleanup.

## Consequences

- The bundle stays small and legible; a trace is a path, not a payload.
- Whoever reads the bundle needs access to the same filesystem. That's fine while the caller and the agent share a machine; it's a real constraint if the agent runs elsewhere.
- The engine has filesystem side effects, so tests need a temp `outputDir` and must not depend on the engine tidying up.
- `metrics` gets a path to the raw Lighthouse JSON; the curated core lives inline (see ADR 0010).
