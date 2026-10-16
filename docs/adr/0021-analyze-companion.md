# ADR 0021: The analyze companion judges a bundle with a caller-supplied reasoner

Status: accepted

## Context

The engine emits evidence and no verdict (ADR 0003), and holds no model (ADR 0004). But the workflow needs a judging step: something reads a bundle and says what matters. That step must not pull a model into the engine.

## Decision

A separate entry point, `renderdragon/analyze`, exports `analyze(bundle, reasoner)`. A `Reasoner` is a tiny text-in, text-out interface (`complete({ system, user })`). Provider adapters for OpenAI and Anthropic ship in the same subpath, implemented with `fetch` so no SDK dependency is added.

The result is a validated `Analysis`: a summary plus ranked findings, each with a severity, a rationale, optional recommendation, and evidence references to observation ids or metric names. Invalid model output triggers one repair retry, then a `RenderDragonError` with code `ANALYSIS`.

## Consequences

- The engine stays model-free and cheap to import. `import { audit } from 'renderdragon'` never pulls in the analysis layer.
- Adapters read keys from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (or an explicit option) and never log them.
- Evidence references that do not resolve against the bundle are dropped, so a hallucinated citation cannot silently pass.
- Model output is nondeterministic, so an analysis is not reproducible. The bundle it reads is; that is where reproducibility lives.
- The seam is a plain function, so a caller can supply any model, a local one, or a stub in tests without an adapter.
