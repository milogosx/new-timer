# Decision Log

Last updated: March 15, 2026

## ADR-Style Entry Format

- ID
- Date
- Decision
- Context
- Alternatives considered
- Consequence
- Status (`accepted`, `implemented`, `superseded`)

## Decisions

### D-001

- Date: 2026-02-15
- Decision: Canonical workouts are user-editable defaults after first load.
- Context: Existing migration behavior preserves edits to canonical IDs.
- Alternatives considered: enforce immutable canonical defaults on every load.
- Consequence: Better user trust/customization, but baseline updates require explicit migration strategy.
- Status: accepted

### D-002

- Date: 2026-02-15
- Decision: Active-session persistence should be throttled (target ~1s cadence) plus transition-based writes.
- Context: Current per-frame persistence increases performance/battery risk.
- Alternatives considered: keep per-frame writes; persist only on pause/stop.
- Consequence: Reduced write load with small tradeoff in worst-case progress loss window.
- Status: implemented

### D-003

- Date: 2026-02-15
- Decision: Support baseline is modern mobile Safari + modern Chromium mobile, with graceful degradation.
- Context: Wake lock/audio policies vary by browser/device.
- Alternatives considered: broad legacy support guarantees; single-browser optimization.
- Consequence: Clear product expectation and simpler compatibility model.
- Status: implemented

### D-004

- Date: 2026-02-15
- Decision: Netlify config is portable and in-repo.
- Context: Machine-specific absolute path created deploy fragility.
- Alternatives considered: environment-local config only.
- Consequence: Reproducible deploy behavior; requires avoiding local state leakage in commits.
- Status: implemented

### D-005

- Date: 2026-02-15
- Decision: Workout defaults persist via Netlify Blobs profile sync (Functions-backed), with local cache fallback.
- Context: Sole-user editing across devices requires durable defaults without hardcoding and without relying only on browser-local storage.
- Alternatives considered: localStorage only; external hosted database.
- Consequence: Cross-device durability improves immediately; introduces serverless dependency and endpoint-hardening risk.
- Status: implemented

### D-006

- Date: 2026-02-15
- Decision: Canonical workout/warm-up/cardio deletions are persisted as tombstone ID lists.
- Context: Canonical defaults were being reinserted after deletion during migration/upsert flows.
- Alternatives considered: hard-delete defaults from canonical seed; prevent deleting defaults.
- Consequence: User intent for deleting defaults persists across reloads/devices while preserving canonical seed for reset flows.
- Status: implemented

### D-007

- Date: 2026-02-15
- Decision: Cloud profile sync uses client-timestamp conflict ordering and retry-on-failure lifecycle flushing.
- Context: Eventual-consistency windows and dropped writes caused occasional stale rehydration.
- Alternatives considered: keep best-effort fire-and-forget writes; synchronous/blocking startup hydration.
- Consequence: Better durability and lower chance of stale-state resurrection, with slightly more sync complexity.
- Status: implemented

### D-008

- Date: 2026-02-15
- Decision: Add auth gate for profile endpoints before broader (non-trusted) sharing.
- Context: Current endpoints are unauthenticated and acceptable only for single-user/trusted use.
- Alternatives considered: keep endpoints open; simple static secret only.
- Consequence: Requires selecting auth model and rollout plan before expansion.
- Status: accepted (deferred)

### D-009

- Date: 2026-02-15
- Decision: Add user-controlled Battery Saver mode that reduces timer-screen effects and switches timer ticks to coarse cadence.
- Context: Long workout sessions on iPhone showed elevated heat/battery use versus expected timer-app baseline.
- Alternatives considered: keep full effects always on; remove effects globally with no toggle.
- Consequence: Lower sustained rendering/animation load on mobile while preserving timing accuracy via monotonic elapsed-time derivation.
- Status: superseded

### D-010

- Date: 2026-03-15
- Decision: Freeze Tier 1 contracts to the implemented runtime: `eliteTimer_settings` stores only `sessionMinutes` and `intervalSeconds`, and the dormant `eliteTimer_audioPrefs` storage path is retired.
- Context: Tests and docs had drifted away from the current application behavior, including references to removed `batterySaverMode`, `useBackgroundMusicState`, and background-music runtime paths.
- Alternatives considered: restore the removed settings/audio features to match stale docs; keep the dormant audio-preference key despite having no runtime consumer; defer contract alignment until broader architecture work.
- Consequence: Runtime, tests, and docs now describe the same active storage contract, and future work no longer has a dead audio-preference surface to misread as supported behavior.
- Status: implemented

### D-011

- Date: 2026-03-15
- Decision: Clarify Tier 2 boundaries by centralizing saved-session restore policy in `sessionResumePolicy`, fixed timer-phase timing in `timerPhase`, and profile-driven screen refresh in App-level `profileRevision`.
- Context: Session persistence, timer-phase semantics, and storage-backed screen refresh behavior were split across `TimerScreen`, `useTimer`, `App`, and profile CRUD screens in ways that made bugs and stale-data behavior harder to reason about.
- Alternatives considered: leave the boundaries implicit until a broader Tier 3 refactor; move directly to a larger architectural split of `workoutStorage` and timer/session modules.
- Consequence: The current subsystem boundaries are explicit in code without yet restructuring the larger modules. Profile-backed screens now refresh from a shared app-level revision signal, and timer restore/phase rules are defined by dedicated helpers.
- Status: implemented
