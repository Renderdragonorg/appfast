# Remaining work

The core is implemented and verified end to end against a real browser. What is done:

- Package scaffold, frozen types, and the `audit()` orchestrator.
- Lighthouse cold-browser path with curated metric extraction and artifacts.
- Shared check browser with CDP throttling; `scrollJank`, `heavyPayload`, `interactionStorm`, and opt-in `longSession`.
- Bundle and artifact writer; session setup with auth refresh.
- Error wrapping: `BROWSER_LAUNCH`, `NAVIGATION`, `LIGHTHOUSE`, `CHECK`, `AUTH_EXPIRED`, and `CONFIG` are all raised as `RenderDragonError` now.
- `caveats` records warm repeats and mid-run auth refreshes.

## Left to do

Nothing is blocking. These are the plausible next pieces, in the order they seem worth doing:

1. A thin CLI over the library (`renderdragon audit <url> --out <dir>`), for use in CI. The library is the product; the CLI is a wrapper.
2. A published `analyze()` companion that reads a bundle and produces the ranked, judged summary the engine deliberately does not (a separate module, still no model inside the engine).
3. Tunables: expose `detailRows` and a per-check duration on `Target` instead of the current constants.
4. More checks (e.g. a font/layout-shift probe, a third-party script weight probe).

None of these should reopen an ADR. If one does, write a new ADR rather than editing an old one.
