# ADR 0025: The product is named AppFast

Status: accepted

## Context

The package, repo, and CLI were named `renderdragon`. That is also the organisation and the engine brand, and it is the name of Minecraft Bedrock's renderer. Two names for one thing made the install line, the binary, and the docs disagree with the project directory, which was already `appfast`.

## Decision

User-facing names are AppFast:

- npm package and import path: `appfast`
- binary: `appfast`
- default output directory: `appfast-out`
- environment variables: `APPFAST_CHROME_PATH`, `APPFAST_LONG_SESSION_MS`
- error class: `AppFastError`
- OpenCode agent: `appfast-analyzer`

The README and spec describe AppFast as a Renderdragon performance audit engine. Older ADRs keep the names they used when they were written. This ADR records the change.

## Consequences

- The package name, binary, import path, error class, and environment variables changed. That is a breaking rename, acceptable because there are no external users yet.
- The organisation and engine brand stay Renderdragon. The product is AppFast.
- The npm registry had no `appfast` package when this was written, so the name was available.
