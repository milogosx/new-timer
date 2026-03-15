# Risk Register

Last updated: March 15, 2026

## Active Risks

| ID | Risk | Impact | Likelihood | Current Signal | Mitigation Direction | Status |
|---|---|---|---|---|---|---|
| R1 | Active-session rendering/tick overhead under prolonged runs | Performance/battery drain on mobile | Medium | Running-state writes are throttled (~1s) and timer progression is driven by monotonic timing, but there is no separate battery-saver control path in the current runtime | Tune active-session rendering/audio behavior with field data and keep timing correctness decoupled from visual cadence | Mitigated (monitoring) |
| R2 | Browser wake lock variability | Screen sleep during active sessions | Medium | API unsupported or denied on some devices | Graceful fallback UX + capability messaging | Open |
| R3 | Audio autoplay/visibility policy differences | Missing countdown, bell, or speech behavior | Medium | Browser gesture policy differences | Keep unlock-on-interaction strategy and fallback behavior | Open |
| R4 | Migration semantics ambiguity for canonical workouts | Data expectation mismatch | Medium | Tests previously disagreed with behavior | Document policy and lock tests to policy | Open |
| R5 | Netlify local state drift in `.netlify/` | Environment-specific config noise | Medium | Tooling can write local state artifacts | Keep portable config only; review before commit | Open |
| R6 | Docs and tests drifting from implementation | Slower onboarding, unsafe change confidence | Medium | Tier 1 contract pass realigned README, architecture docs, and tests, but drift recurred across multiple docs before cleanup | Treat docs as living; update during behavior changes and keep contract-bearing docs in the same change set | Open |
| R7 | Unauthenticated cloud profile endpoints | Unauthorized profile overwrite risk | Medium | Endpoints are same-origin and profile-id scoped, but no user auth gate yet | Add auth gate (Netlify Identity/JWT or signed token workflow) before multi-user/public expansion | Open (deferred gate) |
| R8 | Eventual-consistency lag in cloud profile reads | Temporary reversion perception after edits | Medium | Observed stale-read behavior during rapid edit/reload testing | Client timestamp conflict policy + tombstones + retry/lifecycle flushes; continue monitoring | Mitigated (monitoring) |

## Monitoring Signals

- CI/local gate failures (`lint`, `test`).
- User reports of timer drift, resume mismatch, or sleep/audio interruptions.
- Unexpected schema migrations or missing defaults after app updates.
- Unexpected cloud profile resets or edits from untrusted clients.
- Reports of defaults briefly reappearing after delete/edit and reload.

## Mitigations

- Keep test contracts aligned with intentional behavior.
- Require invariant/doc updates alongside behavior changes.
- Add targeted regression tests when touching timer, persistence, or migration code.
- Track deferred bugs separately from structure-only refactors.
- Treat endpoint auth as release gate before broader sharing.

## Deferred Items

- Define explicit support matrix for browsers/devices.
- Add optional E2E smoke flow for critical timer lifecycle.
- Choose and implement endpoint auth model (see D-008).
