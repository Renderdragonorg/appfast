# Remaining work

The engine and the analyze companion are implemented and verified end to end against a real browser.

Done:
- Package scaffold, frozen types, and the `audit()` orchestrator.
- Lighthouse cold-browser path with curated metric extraction and artifacts.
- Shared check browser with CDP throttling; `scrollJank`, `heavyPayload`, `interactionStorm`, and opt-in `longSession`.
- Bundle and artifact writer; session setup with auth refresh.
- Error wrapping: `BROWSER_LAUNCH`, `NAVIGATION`, `LIGHTHOUSE`, `CHECK`, `AUTH_EXPIRED`, `CONFIG`, and `ANALYSIS` all raised as `RenderDragonError`.
- `caveats` records warm repeats and mid-run auth refreshes.
- `renderdragon/analyze`: a validated, model-agnostic judging companion with OpenAI and Anthropic adapters (ADR 0021), backed by observation ids for evidence citation (ADR 0022).

## Left to do

Nothing is blocking. Candidate next pieces, roughly in order of value:

1. A thin CLI over both entries (`renderdragon audit <url> --out <dir>`, `renderdragon analyze <bundle.json>`), for CI and manual runs.
2. Tunables: expose `detailRows` and a per-check duration on `Target` instead of the current constants.
3. More reasoner adapters, or a local-model adapter.
4. More checks (e.g. a font-swap/layout-shift probe, a third-party script weight probe).

None of these should reopen an ADR. If one does, write a new ADR rather than editing an old one.
