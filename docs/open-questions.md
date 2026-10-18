# Remaining work

The engine and the analyze companion are implemented and verified end to end against a real browser.

Done:
- Package scaffold, frozen types, and the `audit()` orchestrator.
- Lighthouse cold-browser path with curated metric extraction and artifacts.
- Shared check browser with CDP throttling; `scrollJank`, `heavyPayload`, `interactionStorm`, and opt-in `longSession`.
- Bundle and artifact writer; session setup with auth refresh.
- Error wrapping: `BROWSER_LAUNCH`, `NAVIGATION`, `LIGHTHOUSE`, `CHECK`, `AUTH_EXPIRED`, `CONFIG`, and `ANALYSIS` all raised as `RenderDragonError`.
- `caveats` records warm repeats and mid-run auth refreshes.
- `renderdragon/analyze`: a validated, model-agnostic judging companion with OpenAI, Anthropic, and OpenCode adapters (ADR 0021, ADR 0024), backed by observation ids for evidence citation (ADR 0022).
- A thin `renderdragon` CLI over both entries (ADR 0023).

## Left to do

Nothing is blocking. Candidate next pieces, roughly in order of value:

1. Tunables: expose `detailRows` and a per-check duration on `Target` instead of the current constants.
2. More reasoner adapters, or a local-model adapter.
3. More checks (e.g. a font-swap/layout-shift probe, a third-party script weight probe).

The OpenAI and Anthropic adapters are covered against a stubbed `fetch`. The OpenCode adapter is covered against a stubbed process. A live analysis ran once through `opencode2` with `opencode-go/glm-5.3-flash`, but there is no automated test that calls a real provider.

None of these should reopen an ADR. If one does, write a new ADR rather than editing an old one.
