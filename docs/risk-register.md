# Risk Register

Last updated: March 21, 2026

## Active Risks

| ID | Risk | Impact | Likelihood | Current Signal | Mitigation Direction | Status |
|---|---|---|---|---|---|---|
| R1 | Active-session rendering/tick overhead under prolonged runs | Performance/battery drain on mobile | Medium | Running-state writes are throttled (~1s) and timer progression is driven by monotonic timing, but there is no separate battery-saver control path in the current runtime | Tune active-session rendering/audio behavior with field data and keep timing correctness decoupled from visual cadence | Mitigated (monitoring) |
| R2 | Browser wake lock variability | Screen sleep during active sessions | Medium | API unsupported or denied on some devices | Graceful fallback UX + capability messaging | Open |
| R3 | Physical-iPhone active-session runtime drift under visibility/lock transitions | Missing or delayed interval cues, stale foreground UI, duplicated speech cues, or background-audio policy regressions mid-session | High | Focused physical-iPhone passes now succeeded for countdown start, pause/resume, lock-screen continuation, app-switch return, and audible native speech playback. A duplicate `start_warmup` replay on foreground return was reproduced and fixed, but long-session confidence under lock/app-switch conditions is still incomplete | Keep native cue scheduling, native speech cue state, projected-session reconciliation, and physical-device validation in lockstep; keep the web recovery path as fallback for browser mode and close only after a long physical-iPhone run completes cleanly | Open |
| R4 | Migration semantics ambiguity for canonical workouts | Data expectation mismatch | Medium | Tests previously disagreed with behavior | Document policy and lock tests to policy | Open |
| R5 | Netlify local state drift in `.netlify/` | Environment-specific config noise | Medium | Tooling can write local state artifacts | Keep portable config only; review before commit | Open |
| R6 | Docs and tests drifting from implementation | Slower onboarding, unsafe change confidence | Medium | Tier 1 contract pass realigned README, architecture docs, and tests, but drift recurred across multiple docs before cleanup | Treat docs as living; update during behavior changes and keep contract-bearing docs in the same change set | Open |
| R7 | Unauthenticated cloud profile endpoints | Unauthorized profile overwrite risk | Medium | Endpoints are same-origin and profile-id scoped, but no user auth gate yet | Add auth gate (Netlify Identity/JWT or signed token workflow) before multi-user/public expansion | Open (deferred gate) |
| R8 | Eventual-consistency lag in cloud profile reads | Temporary reversion perception after edits | Medium | Observed stale-read behavior during rapid edit/reload testing | Client timestamp conflict policy + tombstones + retry/lifecycle flushes; continue monitoring | Mitigated (monitoring) |

## Monitoring Signals

- CI/local gate failures (`lint`, `test`).
- User reports of timer drift, resume mismatch, or sleep/audio interruptions.
- Repeated user need to foreground the iPhone shell before missed interval bells suddenly catch up.
- Repeated speech restarts such as `start_warmup` replaying after foreground return during a still-active session.
- Repeated user need to tap the manual sound-recovery control during a single web/PWA session.
- Unexpected schema migrations or missing defaults after app updates.
- Unexpected cloud profile resets or edits from untrusted clients.
- Reports of defaults briefly reappearing after delete/edit and reload.

## Mitigations

- Keep test contracts aligned with intentional behavior.
- Require invariant/doc updates alongside behavior changes.
- Add targeted regression tests when touching timer, persistence, or migration code.
- Track deferred bugs separately from structure-only refactors.
- Treat endpoint auth as release gate before broader sharing.
- Preserve the native cue-scheduler + projected-session reconciliation path on iPhone while `R3` remains open.
- Preserve native speech cue-state continuity across mirrored-session updates while `R3` remains open.
- Preserve the stalled-playback recovery and manual sound-recovery behavior in web/PWA mode while `R3` remains open.

## Deferred Items

- Define explicit support matrix for browsers/devices.
- Add optional E2E smoke flow for critical timer lifecycle.
- Choose and implement endpoint auth model (see D-008).
- Close `R3` only after a long physical-iPhone session completes with no missed or delayed interval cues, no duplicate speech cues on repeated foreground returns, correct UI catch-up on foreground return, and no regressions to Spotify/background-audio coexistence.
