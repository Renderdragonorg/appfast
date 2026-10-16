# ADR 0006: One entry point, one shared browser

Status: superseded by ADR 0011 (the single-entry-point part stands; the single-browser part does not)

## Context

The interface could expose many entry points (run Lighthouse, run each check) or a single deep one. Separately, Lighthouse launches its own Chrome, and the custom checks need a browser too, so a run could use one instance or two.

## Decision

The public interface is a single call: `audit(target)` returns one bundle and runs everything. Internally, a run uses one shared Chrome. Lighthouse drives it on a debug port, and the custom checks reuse it.

## Consequences

- Smallest possible interface. One call site to learn; the whole engine sits behind it.
- The caller can't run a single check in isolation through the public API. If that's ever needed, a narrower entry point gets added deliberately, not by default.
- Sharing one browser means one throttle profile for the whole run, which keeps Lighthouse and the checks comparable.
- Because there is one browser implementation, there is no browser-driver seam yet. Per design rules, a seam is only real when two things vary across it, so none is introduced here.
