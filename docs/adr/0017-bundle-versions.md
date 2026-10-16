# ADR 0017: Bundle carries a shape version and an engine version

Status: accepted

## Context

The bundle is the contract between the engine and the agent. It will change shape over time, and a reader needs to know which shape it's reading and which engine produced it.

## Decision

The bundle carries two fields:
- `bundleVersion`: the shape of the bundle. Bumped only on a breaking change.
- `engineVersion`: the engine build that produced it.

## Consequences

- An agent can branch on `bundleVersion` and know whether it can read the bundle at all.
- `engineVersion` makes a confusing result traceable to a specific build.
- Additive changes (a new metric, a new check) do not bump `bundleVersion`; only removals and renames do.
- The rule needs to be stated where contributors will see it, or the version will drift.
