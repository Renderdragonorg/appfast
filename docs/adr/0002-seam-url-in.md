# ADR 0002: Caller passes a URL; the engine owns the browser

Status: accepted

## Context

A perf library's shape is decided by who owns the browser. Three options: the caller passes a URL and the engine owns Chrome; the caller passes a page/session it already controls; or the engine only parses artifacts (traces, HAR) the caller captured.

## Decision

The caller passes a URL. The engine owns the browser lifecycle: launch, navigate, throttle, measure, close. The interface stays small; the work stays hidden.

## Consequences

- The engine can assume a cold, controlled load, which is what lab measurement needs.
- The interface must carry run configuration (viewport, device emulation, throttling, auth headers/cookies) since the caller can't pre-configure a session.
- Logged-in flows and multi-step navigation are not first-class yet. If they become necessary, the seam has to grow (see open questions).
- Lighthouse also launches its own Chrome, so the engine owns two browsers unless that's unified. This is an open implementation question with real cost.
