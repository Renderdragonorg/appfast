# ADR 0010: TypeScript on Node, curated metrics plus raw Lighthouse JSON

Status: accepted

## Context

Lighthouse is a Node package, so the engine runs on Node. Lighthouse also emits a large report, most of which is noise for the downstream agent.

## Decision

The engine is TypeScript on Node. The `Bundle` and `Target` types are the interface. `metrics` carries a curated core set (LCP, CLS, TBT, TTFB, FCP, speed index) inline, plus a path to the raw Lighthouse JSON so nothing is lost.

## Consequences

- The interface is typed; TypeScript is part of what a caller learns.
- The curated set is chosen for signal. The raw JSON path is the escape hatch for any metric left out.
- If a metric graduates into the core set later, the bundle gains a field; that's additive and safe.
- The engine inherits Lighthouse's Node version constraints and its dependency weight.
