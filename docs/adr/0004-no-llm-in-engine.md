# ADR 0004: No model inside the engine

Status: accepted

## Context

The engine's evidence bundle feeds an AI agent. Two shapes were possible: the engine calls the model itself and returns an analysis, or the engine stops at evidence and a separate step does the reasoning.

## Decision

The engine has no LLM dependency. It produces the evidence bundle and stops. The agent runs as a separate step, outside the engine.

## Consequences

- The engine is deterministic in shape and cheap to run and test. No API keys, no retries, no token accounting.
- The bundle becomes the contract between two systems that never share a process. Versioning it matters.
- Whoever runs the agent decides which model and prompt. The engine stays neutral about reasoning.
- An optional `analyze()` layer could later wrap an agent over the bundle, but it would be a separate module, not part of the engine core.
