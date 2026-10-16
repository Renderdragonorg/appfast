# ADR 0013: Default throttle is the Lighthouse mobile preset

Status: accepted

## Context

Throttling decides what "slow" means. Unthrottled numbers reflect the machine running the audit, not a real user. Lighthouse ships a mobile preset (roughly 4x CPU slowdown, Slow 4G).

## Decision

The default `throttle` profile is the Lighthouse mobile preset. A caller can override it per target.

## Consequences

- Out-of-the-box numbers reflect a realistic mobile user, which is where web perf problems hurt most.
- Runs are slower by design. The default N=1 helps offset that.
- LCP, INP, and TBT are meaningful under this profile; on an unthrottled desktop they often look fine even when real users suffer.
- Desktop, if wanted, is an explicit override, not the default.
