# ADR 0022: Observations carry an id so findings can cite evidence

Status: accepted

## Context

An analysis must point at the evidence behind each finding. Observations had no stable identifier, so a finding could only reference one by position, which is brittle and ambiguous across repeats.

## Decision

Add a required `id` to `Observation`. Checks produce an `ObservationDraft` (no id); the orchestrator assigns `id` when it collects them, as `${check}-${repeat}-${index}`. The change is additive, so `bundleVersion` stays 1 (ADR 0017).

## Consequences

- A finding cites an observation by id, and `analyze` drops any id that does not resolve in the bundle.
- Ids are assigned in one place, so they are stable within a bundle and don't depend on the check's internals.
- Check modules return drafts, not finished observations, so id assignment cannot drift per check.
- Writing the id in the check would duplicate the rule four times; the orchestrator owns it instead.
