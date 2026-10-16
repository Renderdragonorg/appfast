# ADR 0001: Audit web pages, ship as a library

Status: accepted

## Context

The name "RenderDragon" is Minecraft Bedrock's renderer, which points at game/frame rendering. The work pulled in a web-perf skill instead. The first user is the author auditing their own projects. Several product shapes were on the table: CLI, CI gate, hosted dashboard, library.

## Decision

The engine audits web pages and web apps. It ships as a library (an SDK imported into other code), not a CLI, service, or dashboard. The name is branding; the subject is web performance.

## Consequences

- No CLI, no server, no storage. A caller drives it and gets a return value back.
- A CLI or CI wrapper can be built later on top of the library, but the library is the product.
- "RenderDragon" stays as the brand. The docs state plainly that the target is web pages, so nobody expects a Bedrock render-graph tool.
