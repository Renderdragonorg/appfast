# ADR 0008: The target object carries all configuration

Status: accepted

## Context

The entry point is `audit(...)`. Configuration has to get in somehow: number of runs, throttling profile, viewport/device, auth headers and cookies, which checks to run, where to write artifacts. Options could be a second parameter, or live inside the target.

## Decision

The single parameter is an object:

```ts
audit(target: Target): Promise<Bundle>

type Target = {
  url: string
  runs?: number            // default 1
  throttle?: ThrottleProfile
  viewport?: Viewport
  headers?: Record<string, string>
  cookies?: Cookie[]
  checks?: CheckName[]     // default: scroll jank, heavy payload, interaction storm
  outputDir?: string
  refreshAuth?: () => Promise<Credentials>  // called on detected logout; one retry (ADR 0020)
}
```

Everything lives in one object so the shape can grow without changing the arity of the call.

## Consequences

- The bare call needs defaults: `audit({ url })` runs Lighthouse plus all four checks once, and writes artifacts somewhere sensible.
- Auth is a pre-authenticated session only: injected headers and cookies, no scripted login flow.
- `Target` is a public type. Adding a field is easy; removing or renaming one is a breaking change once anyone depends on it.
- `outputDir` is supplied here; its lifecycle is covered in ADR 0009.
