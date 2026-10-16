# ADR 0020: Auth expiry triggers a caller-supplied refresh and one retry

Status: accepted

## Context

Cookies and headers can expire during a run, especially across repeats and the minutes-long session check. A silently logged-out page produces numbers that look fine and mean nothing.

## Decision

`Target` takes an optional `refreshAuth` callback. When the engine detects a logged-out state (a redirect to a login route, a missing session cookie, a configured signal), it calls `refreshAuth`, applies the returned credentials, and retries once. If it's still logged out, the run fails.

## Consequences

- The engine never silently measures a logged-out page. A wrong result is worse than a failed run.
- The caller supplies the refresh logic, since only they know how to get a new token. The engine stays neutral.
- One retry, not a loop, so a persistently broken app fails fast instead of hanging.
- Detection is heuristic and per-app; the caller can supply a signal to make it reliable.
