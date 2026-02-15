# Risk Register

Last updated: February 15, 2026

## Active Risks

| ID | Risk | Impact | Likelihood | Current Signal | Mitigation Direction | Status |
|---|---|---|---|---|---|---|
| R1 | Per-frame active-session persistence | Performance/battery drain on mobile | High | `useTimer` persists on every tick | Throttle persistence + persist on transitions | Open |
| R2 | Browser wake lock variability | Screen sleep during active sessions | Medium | API unsupported or denied on some devices | Graceful fallback UX + capability messaging | Open |
| R3 | Audio autoplay/visibility policy differences | Missing countdown/bgm behavior | Medium | Browser gesture policy differences | Keep unlock-on-interaction strategy and fallback behavior | Open |
| R4 | Migration semantics ambiguity for canonical workouts | Data expectation mismatch | Medium | Tests previously disagreed with behavior | Document policy and lock tests to policy | Open |
| R5 | Netlify local state drift in `.netlify/` | Environment-specific config noise | Medium | Tooling can write local state artifacts | Keep portable config only; review before commit | Open |
| R6 | Docs and tests drifting from implementation | Slower onboarding, unsafe change confidence | Medium | Baseline drift occurred before this pass | Treat docs as living; update during behavior changes | Open |

## Monitoring Signals

- CI/local gate failures (`lint`, `test`).
- User reports of timer drift, resume mismatch, or sleep/audio interruptions.
- Unexpected schema migrations or missing defaults after app updates.

## Mitigations

- Keep test contracts aligned with intentional behavior.
- Require invariant/doc updates alongside behavior changes.
- Add targeted regression tests when touching timer, persistence, or migration code.
- Track deferred bugs separately from structure-only refactors.

## Deferred Items

- Implement throttled session persistence cadence.
- Define explicit support matrix for browsers/devices.
- Add optional E2E smoke flow for critical timer lifecycle.
