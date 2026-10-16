# ADR 0003: Emit observations, not findings

Status: accepted

## Context

The first framing had the engine return a score and judged findings with severity, Lighthouse-style. Then the workflow changed: the engine's output is handed to an AI agent that decides what matters. If the agent decides, the engine handing it pre-judged findings invites rubber-stamping and hides the raw facts.

## Decision

The engine emits neutral observations only. Each observation is a fact: an id, its source, a value, and context. No severity, no verdict, no recommendation, no score. Judgment is entirely downstream.

## Consequences

- The engine can't ship a 0-100 score. If a score is wanted, the agent computes it.
- Thresholds still belong in the bundle as *context* ("LCP was 3.1s; the good threshold is 2.5s"), never as a pass/fail stamp.
- The bundle is the product surface. Its shape is a public interface and must be designed as carefully as any function signature.
- Testing gets easier: the engine is judged on whether it observed facts correctly, not on whether its opinions match a reference.
