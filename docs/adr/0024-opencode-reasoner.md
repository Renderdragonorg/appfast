# ADR 0024: OpenCode can back the reasoner without API keys

Status: accepted

## Context

The analyze companion needs a model (ADR 0021). The shipped adapters read `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, which means a user who already pays for a model through OpenCode has to create and store a second credential. OpenCode V2 already knows the user's providers, models, and login, and exposes them through `opencode run`.

## Decision

`createOpenCodeReasoner` spawns OpenCode V2 and reads its JSON event stream. It calls `opencode run --format json` with a chosen model, writes the digest to stdin, and concatenates the `text` events. Two defaults: the binary is `opencode2` and the model is `opencode-go/glm-5.3-flash`. Both are options.

Each call runs in a throwaway directory holding an `opencode.json` that defines a `renderdragon-analyzer` agent. The agent carries the analyzer system prompt and denies every permission. A bundle is untrusted input, and a digest that contains instructions should not be able to run shell commands or edit files in the caller's project. The directory is removed after the call.

The adapter drops a leading `</think>` or `<think>...</think>` block, because some models leak their reasoning close tag into the visible text.

## Consequences

- The caller needs OpenCode V2 and an authenticated model, but no separate API key. The CLI exposes this as `--provider opencode`.
- One analysis starts one OpenCode process and one session. That costs a process launch and whatever the chosen model costs. It is not a hot path.
- The JSON event format is now a contract with OpenCode. A change there breaks this adapter only, not the other providers.
- Denying all tools limits prompt injection to the model's written answer. `analyze` still validates that answer, drops unknown evidence references, and retries once.
- The adapter cannot run on a machine without OpenCode. That is the trade for reusing an existing login.
