# ADR 0014: Check repeats accept a warm browser

Status: accepted

## Context

ADR 0011 gave the checks a browser that persists across repeats, which means cache, storage, and service workers carry over. Repeat 2 isn't repeat 1. The same cold-load problem Lighthouse has, now one level down. Options: isolate each repeat with a fresh context, or accept the warmth.

## Decision

Repeats share the warmed check browser. The bundle records the repeat index and the warm state so the agent can discount later samples.

## Consequences

- Cheaper and simpler. No per-repeat context teardown.
- Later repeats measure a warmer, faster page. The spread across repeats is partly real variance and partly warming, and the bundle must not pretend otherwise.
- Check numbers aren't cold-load comparable to Lighthouse's cold load. They're a separate measurement on a live, warmed page.
- If faithful cold check numbers are ever needed, isolation becomes an explicit option, not the default.
