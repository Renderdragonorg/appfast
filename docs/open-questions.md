# Remaining work

Every design decision is captured in an ADR, and `docs/spec.md` turns them into a buildable spec: full `Target` and `Bundle` types, the observation envelope, one payload per check, defaults, failure modes, and a worked bundle.

What's left is implementation, not design:

1. Scaffold the package: `package.json`, `tsconfig.json`, entry point exporting `audit`.
2. Wire Lighthouse on its own cold browser; reshape its report into the curated metrics.
3. Build the check browser and the three default checks against the payload shapes in the spec.
4. Write the bundle, artifacts, and `caveats`.
5. Add `refreshAuth` handling and the failure paths from the spec's Failure modes section.

Nothing here should reopen an ADR. If something does, write a new ADR rather than editing the old one.
