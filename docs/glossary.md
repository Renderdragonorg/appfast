# Glossary

Terms used across the engine, the bundle it emits, and anything downstream that reads it. Use these words exactly. When a term is still contested, it's marked open.

## Engine
The library itself. Takes a target, drives a browser, runs Lighthouse and the custom checks, and returns one evidence bundle. The engine does not judge. It records facts. There is no model, no score, and no verdict inside it.

## Target
What gets audited: a URL, plus optional configuration (viewport, device emulation, network/CPU throttling, headers or cookies for auth). A target is data. The engine turns it into a run.

## Run
One audit of one target, producing one evidence bundle. A run is bounded and repeatable. Run-to-run noise is expected and handled explicitly (see below), never hidden.

## Evidence bundle
The engine's entire output. A JSON document with a stable shape, plus references to artifacts on disk (traces, screenshots, HAR, console logs). It is the seam between the engine and whatever reads it: an AI agent, a human, or a test. Because the agent consumes it, the bundle is a public interface, not a debug dump.

## Observation
A single neutral fact recorded during a run, with no severity, verdict, or recommendation. Every observation shares one envelope: an `id` (assigned by the orchestrator so findings can cite it), the check it came from, a `kind` naming its payload shape, a timestamp, and the payload itself. The envelope is uniform; the payload varies by kind. See ADR 0018, ADR 0022.

## Metric
A numeric reading from a standard lab source (Lighthouse, or a browser timing API). Open: whether a metric is just an observation with a numeric source, or a distinct type. This is the axis the result model turns on.

## Check
A custom synthetic probe the engine runs beyond Lighthouse:
- Throttled scroll jank: scroll a loaded page under throttled CPU/network, record frame drops and long tasks. Reports aggregates plus the worst offenders.
- Heavy-payload render: load a page with lots of data, DOM nodes, and images; measure render and interaction cost.
- Interaction storm: rapid clicks, typing, and route changes; measure INP under stress.
- Long-session leak: interact for minutes, watch memory and DOM node growth. Opt-in only (ADR 0015), not in the default set.

A check is a source of observations, the same as Lighthouse is. The default set is the first three.

## Lab
The environment a measurement happens in: a fresh browser, one cold load, defined throttling. Lab numbers are one sample, not real-user truth. Distinct from field data (real-user percentiles), which this engine does not collect.

## Browser driver
The adapter that owns the Chrome instance for a run: launch, navigate, throttle, collect. Open: whether Lighthouse and the custom checks share one browser or run separately.

## Downstream agent
Anything that reads the evidence bundle and decides what matters. It is outside the engine. It produces the verdict, ranking, and recommendations the engine deliberately refuses to produce.

## Noise
Variation between identical runs. Lighthouse is noisy, and a browser under load is noisier. The engine's job is to make noise visible in the bundle, so the agent can tell a real problem from an unlucky sample.

## Reasoner
A model call shaped as text in, text out: `complete({ system, user })`. The analyze companion takes one from the caller, so the engine never depends on a model. Provider adapters for OpenAI and Anthropic satisfy it.

## Analysis
The output of `analyze`: a summary plus ranked findings. Produced outside the engine, by reading a bundle. Nondeterministic, because a model writes it.

## Finding
One judged problem inside an Analysis: a severity, a title, a rationale, an optional recommendation, and evidence references.

## Evidence reference
A pointer from a finding back into the bundle: either an observation id or a metric name. References that do not resolve in the bundle are dropped.
