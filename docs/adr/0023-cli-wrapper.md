# ADR 0023: A thin CLI ships as a wrapper over both entries

Status: accepted

## Context

The library is the product (ADR 0001), and audits are driven from code. But running an audit by hand, or from CI, wants a command. Adding a CLI risks pulling the analysis layer (and a model) into every install.

## Decision

A single `renderdragon` bin ships in the same package. It is a thin wrapper: `audit <url>` calls the engine, `analyze <bundle.json>` calls the analyze companion. It has no dependencies and no logic beyond argument parsing and printing. Argument parsing is a pure function, and the command runner takes its dependencies injected, so both are unit-tested without a browser or a model.

## Consequences

- Installing the package does not require a model key; `analyze` needs one, `audit` does not.
- The CLI imports both entries, so it is the only place they meet. The root library import still pulls in neither the CLI nor analyze.
- The CLI is deliberately small. Rich reporting belongs in the analyze companion or a consumer, not here.
- `--json` on both commands makes the CLI scriptable without parsing human output.
