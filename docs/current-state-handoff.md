# Current State Handoff

Last updated: March 15, 2026

Use this file at the start of the next session. It captures the outcome of the Tier 1 and Tier 2 remediation passes, the currently stabilized subsystem boundaries, and the recommended starting point for the next implementation wave.

## What Was Completed

### Tier 1: Local Fixes and Contained Corrections

Completed:
- Retired stale `batterySaverMode` and background-music runtime assumptions from the active contract.
- Reduced the settings contract to `eliteTimer_settings = { sessionMinutes, intervalSeconds }`.
- Retired the dormant `eliteTimer_audioPrefs` / `bgmEnabled` storage path.
- Centralized settings normalization in `src/utils/storage.js` and reused it from `src/components/HomeScreen.jsx`.
- Fixed save-time exercise normalization so explicit `rest: 0` is preserved.
- Removed dead internal surfaces:
  - `useTimer.finish`
  - `.ctrl-btn-finish`
  - `audioManager.isInitialized()`
- Realigned docs and tests to the implemented runtime.

Primary files touched in Tier 1:
- `src/utils/storage.js`
- `src/components/HomeScreen.jsx`
- `src/utils/exerciseSanitizer.js`
- `src/hooks/useTimer.js`
- `src/utils/audioManager.js`
- `src/components/TimerScreen.css`
- `tests/storage.test.js`
- `tests/exerciseSanitizer.test.js`

### Tier 2: Boundary Clarifications and Subsystem Cleanups

Completed:
- Clarified the app-level profile refresh boundary through `profileRevision` in `src/App.jsx`.
- Clarified saved-session ownership:
  - `src/utils/sessionSnapshot.js` now owns session metadata construction and payload sanitization.
  - `src/utils/sessionResumePolicy.js` now owns timing compatibility, workout identity matching, and checklist restore/reset policy.
- Clarified fixed timer-phase behavior:
  - `src/utils/timerPhase.js` now defines the fixed 15-minute warm-up timing window and speech milestones.
- Clarified workout/profile read boundaries:
  - `src/utils/workoutStorage.js` now exposes screen-facing read models:
    - `loadWorkoutLibraryData()`
    - `loadWorkoutAttachmentOptions()`
    - `getWorkoutExerciseSections()`
  - duplicated warm-up/cardio reference cleanup was consolidated inside `workoutStorage`.
- Updated profile CRUD screens to notify App when canonical profile data changes.
- Updated contract-bearing docs to reflect the stabilized boundaries.

Primary files touched in Tier 2:
- `src/App.jsx`
- `src/components/TimerScreen.jsx`
- `src/components/WorkoutLibrary.jsx`
- `src/components/WorkoutEditor.jsx`
- `src/components/WarmupEditor.jsx`
- `src/components/CardioEditor.jsx`
- `src/utils/sessionSnapshot.js`
- `src/utils/sessionResumePolicy.js`
- `src/utils/timerPhase.js`
- `src/utils/workoutStorage.js`
- `tests/sessionSnapshot.test.js`
- `tests/sessionResumePolicy.test.js`
- `tests/timerPhase.test.js`

## Current Stabilized Contracts

### Settings and Local State

- `eliteTimer_settings` contains only:
  - `sessionMinutes`
  - `intervalSeconds`
- Settings normalization rules:
  - non-numeric values fall back to defaults
  - numeric values clamp to supported bounds
- Theme remains local-only via `er-timer-theme`.
- Active sessions remain local-only via `eliteTimer_activeSession`.

### Saved Session Boundary

Authoritative modules:
- `src/utils/sessionSnapshot.js`
- `src/utils/sessionResumePolicy.js`

Current contract:
- persisted session metadata is limited to:
  - `workoutId`
  - `workoutName`
  - `exerciseProgress`
- `sessionSnapshot` sanitizes that metadata before persistence.
- resume timing compatibility is based on:
  - `sessionDuration`
  - `intervalDuration`
- checklist restore policy is based on `workoutId` identity only.
- if the saved workout identity does not match the current workout identity, checklist progress resets.

### Timer Phase Boundary

Authoritative module:
- `src/utils/timerPhase.js`

Current contract:
- warm-up timing is a fixed 15-minute boundary capped by total session length.
- header phase labels and speech milestones use that fixed timing boundary.
- attached warm-up and cardio routines are checklist content only; they do not currently create timed phases.

### Workout/Profile Boundary

Authoritative modules:
- `src/utils/workoutStorage.js`
- `src/utils/cloudProfileSync.js`
- `src/App.jsx`

Current contract:
- `workoutStorage` remains the canonical client-side profile module for workouts, warm-ups, and cardios.
- App-level `profileRevision` is the refresh signal for Home and Library after:
  - cloud hydration
  - workout CRUD
  - warm-up CRUD
  - cardio CRUD
- screens should prefer explicit read helpers from `workoutStorage` over reconstructing profile reads independently.

## Current Validation Baseline

Most recent checks run successfully:
- `npm test`
- `npm run lint`
- `npm run build`

## Known Open Risks

These remain active after Tier 1 and Tier 2:
- `R2`: Wake Lock variability across browsers/devices.
- `R3`: Audio autoplay / visibility policy differences affecting countdown, bell, or speech behavior.
- `R4`: Migration semantics ambiguity for canonical workouts.
- `R5`: Local `.netlify/` state drift.
- `R6`: Future docs/tests drift if contract-bearing docs are not updated in the same change set as behavior.
- `R7`: Unauthenticated profile endpoints remain deferred but unresolved.
- `R8`: Eventual-consistency lag in cloud profile reads remains mitigated but not eliminated.

See `docs/risk-register.md` for the current wording and mitigation direction.

## Recommended Next Steps

The next implementation wave should start at Tier 3, not back in Tier 2.

Recommended Tier 3 order:
1. Cloud profile sync conflict-model remediation
2. `workoutStorage.js` hub decomposition
3. Deeper session-state structural consolidation

Why this order:
- sync behavior has the widest durability blast radius.
- `workoutStorage.js` is still the largest high-coupling hotspot.
- session-state structure is clearer now, so Tier 3 can refactor it from a stabilized contract instead of moving targets.

## Suggested Next-Session Reading Order

1. `docs/current-state-handoff.md`
2. `docs/architecture-map.md`
3. `docs/invariants.md`
4. `docs/decision-log.md`
5. `docs/risk-register.md`
6. `docs/test-strategy.md`

## Notes For The Next Agent

- Do not reopen Tier 1 or Tier 2 unless new evidence shows a regression in the stabilized contracts above.
- Treat `sessionSnapshot`, `sessionResumePolicy`, `timerPhase`, and the `workoutStorage` read helpers as the current Tier 2 baseline.
- Do not treat attached warm-up/cardio routines as timed phases unless a new product decision is made first.
- If changing persistence or sync behavior, update the contract-bearing docs in the same change set.
