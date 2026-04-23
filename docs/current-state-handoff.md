# Current State Handoff

Last updated: April 21, 2026

Use this file at the start of the next session. It captures the outcome of the Tier 1 and Tier 2 remediation passes, the currently stabilized subsystem boundaries, and the recommended starting point for the next implementation wave.

## April 21 Voice Pack, Coaching, Timer-Only UI, Mute

Completed in the current session:
- migrated voice pack synthesis from edge-tts to local Kokoro (`camilo-kokoro`, `bright` profile / `af_bella` voice, speed 0.9). Manifest at `audio-manifest/voice-pack.json`; render via `audio-manifest/render.py`.
- added motivational coaching cues: 15 warmup + 30 workout short presence-focused lines, target cadence ~120s with ±30s jitter, 20s dead zone around structural milestones. Catalog keys in `speechCueCatalog.js`.
- schedule is generated in JS once per run (idle/countdown → running) via `buildCoachingSchedule(sessionMinutes, seed)` in `timerPhase.js` using a mulberry32-seeded shuffle, embedded in session metadata as `coachingSchedule: [{key, at}, ...]`, and consumed by Swift `EliteTimerRuntimePlugin` which merges structural + coaching into `combinedSpeechMilestones`.
- added timer-only UI mode: `TimerTotalsDisplay` shows total remaining (large) + elapsed (small) with an SVG progress ring. Workout mode keeps `TimerCircle` for intervals.
- added mute toggle in the timer header — gates playback both in the JS bridge (`setRuntimeMuted`) and in Swift `playCueBuffer`/`playSpeechBuffer`. Timer continues; schedules still advance.
- fixed the completion overlay: `useTimer.reset` now captures elapsed-vs-duration before clearing and only surfaces the completion overlay when stop/reset happens after reaching the configured duration.
- added `scripts/sync-voice-pack.mjs` (`npm run voice-pack:sync`) — validates manifest slugs vs rendered WAVs vs `speechCueCatalog.js` vs `EliteTimerRuntimePlugin.swift`, then copies rendered WAVs into both `public/audio/` and `ios/App/App/public/audio/`. Exits nonzero on any mismatch.

Verification:
- `npm test` — 78/78 pass
- `npm run lint` — clean
- `npm run build` — success
- `xcodebuild` — BUILD SUCCEEDED
- `npm run voice-pack:sync` — 53 cues verified and copied into 2 bundles
- coderabbit review pass: 4 findings addressed (first coaching cue dead-zone, `coachingSeed == null` guard, `fastForwardWithoutPlayback` availability filter, `render.py` exit-nonzero on partial render)

## March 22 Resume Guard Follow-Up

Completed in the current session:
- persisted a workout-structure signature alongside saved-session workout identity metadata
- made checklist restore more conservative when the same workout id now has a different exercise/attachment structure
- kept timing resume behavior intact while resetting checklist progress when the saved structure no longer matches the current workout

Current interpretation:
- active-session memory is still intentionally shallow, but it is now safer against edited/reordered workouts
- timing resume remains based on timer configuration compatibility
- checklist restore is now based on both workout identity and a structure signature when that signature is available

## March 21 Speech Stabilization And Closeout

Completed in the current session:
- executed the first bounded `workoutStorage.js` seam extraction without changing the public storage API
- implemented native-owned iPhone speech playback and scheduling using the existing bundled announcement `.mp3` assets
- kept the bell and speech on separate native playback nodes so speech does not replace or block interval bells
- confirmed with the primary user that the app is still single-user/trusted-use only for now
- reproduced and fixed a duplicate `start_warmup` replay bug that occurred when returning to the app during an active session

Current interpretation:
- speech ownership on iPhone is now resolved in favor of native scheduling + native asset playback
- browser/Web Audio speech remains the web/PWA path, not the primary iPhone path
- the duplicate foreground-return speech bug was a mirrored-session identity bug, not a new product behavior requirement
- `R3` should remain open until longer physical-iPhone runs confirm there are no delayed, missing, or duplicated cues over a full workout

## March 20 Stabilization Pass Closeout

Completed in the current session:
- Priority 1: build/deploy trust
  - added a single build-metadata source, boot log, and explicit local iPhone runbook steps
  - added `npm run ios:sim-smoke` so simulator launch/render verification is no longer manual-only
- Priority 2: focused iPhone runtime validation
  - countdown start, pause/resume, lock-screen continuation, and app-switch return were validated on device
  - runtime trace logging now gives cleaner timestamps for countdown, start, interval transition, reset, and native reconciliation events
- Priority 3: timer/audio UX polish
  - the timer screen ended the session in a lighter state than the first polish attempt
  - quick-add is now hidden behind a minimal `+` control instead of occupying the main control row
  - the iOS shell icon generation path now uses the branded app icon instead of the placeholder Xcode icon
- Priority 4: sync/data durability
  - no new production bug was found in the persistence/sync paths
  - regression coverage now explicitly protects warmup/cardio delete cleanup and deleted-default hydration behavior

Current interpretation:
- the app is in a materially stronger state for debugging and iteration than it was at the start of the day
- the next session should not reopen Priorities 1 through 4 unless new evidence shows a regression
- Priority 5 is now a bounded deferred-cleanup plan, not an implied broad refactor
- simulator-first validation is now the preferred visual QA loop for mobile-facing UI work; browser checks are secondary and physical-iPhone runs still close runtime/audio risks

## What Was Completed

### Tier 1: Local Fixes and Contained Corrections

Completed:
- Retired stale `batterySaverMode` and background-music runtime assumptions from the active contract.
- Reduced the settings contract to a bounded `eliteTimer_settings` payload owned by `src/utils/storage.js`.
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
  - Tier 2 centralized screen-facing read models in `src/utils/workoutStorage.js`:
    - `loadWorkoutLibraryData()`
    - `loadWorkoutAttachmentOptions()`
    - `getWorkoutExerciseSections()`
  - Tier 3 has since split those read-only helpers into:
    - `src/utils/workoutReadModels.js`
    - `src/utils/workoutExerciseSections.js`
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

### Tier 3: Remaining Implementation Wave

Status:
- In progress.

Current baseline already in place before Tier 3 work begins:
- cloud profile sync already uses client-timestamp conflict ordering.
- cloud profile sync already retries failed writes and flushes on `online`, `visibilitychange`, and `pagehide`.
- boot hydration already keeps the newer local profile when local `updatedAt` is ahead of remote state.

Completed in the current Tier 3 pass:
- cloud profile sync conflict handling now compares section-level timestamps for `workouts`, `warmups`, and `cardios`.
- an older patch for one section no longer gets dropped only because another section has a newer overall profile timestamp.
- bootstrap hydration and keep-local requeue behavior now have automated coverage in `tests/cloudProfileSync.test.js`.
- Timer exercise-section derivation moved out of `workoutStorage.js` into `src/utils/workoutExerciseSections.js`.
- screen-facing workout library and attachment read models moved out of `workoutStorage.js` into `src/utils/workoutReadModels.js`.

Hybrid iPhone runtime work completed in the current pass:
- The repo now includes a Capacitor iPhone shell plus native `EliteTimerRuntime` plugin in `ios/App/App/EliteTimerRuntimePlugin.swift`.
- The app now has an explicit platform boundary in `src/platform/intervalRuntimeBridge.js`:
  - web/PWA mode still uses `src/utils/audioManager.js`
  - the native iPhone shell now routes interval cue ownership to the native plugin
- Physical-iPhone testing surfaced the key architecture gap:
  - moving bell playback native was not enough while interval scheduling still depended on the JS timer loop
  - when the webview was background-suspended, bells could be delayed until foreground return even if native audio stayed ready
- The native plugin now owns:
  - interval cue scheduling
  - speech milestone scheduling
  - bundled speech asset playback
  - background-audio keepalive
  - mirrored active-session persistence in `UserDefaults`
  - projected-session readback so the React hook can catch up on foreground return
- `TimerScreen` now prefers the fresher native mirrored session over stale local web storage when both exist.
- In the iPhone shell, the bundled speech cues preserve the existing voice assets rather than switching to synthesized text-to-speech.
- The duplicate `start_warmup` replay observed on app return was fixed by preserving native speech cue state across live mirrored-session updates and by treating same-session identity as tolerant to tiny timestamp drift.
- The manual sound-recovery control remains relevant for web/PWA fallback mode, but the current iPhone-native validation focus is now native-owned cue scheduling rather than stalled Web Audio playback alone.

Remaining Tier 3 scope:
- Cloud profile sync conflict-model remediation beyond the current section-level timestamp merge baseline above.
- `workoutStorage.js` hub decomposition.
- Deeper session-state structural consolidation.

## Current Stabilized Contracts

### Settings and Local State

- `eliteTimer_settings` contains:
  - `workoutDefaults`
    - `sessionMinutes`
    - `intervalSeconds`
  - `timerOnlyDefaults`
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
  - `workoutStructureSignature`
  - `exerciseProgress`
  - `speechEnabled`
- `sessionSnapshot` sanitizes that metadata before persistence.
- resume timing compatibility is based on:
  - `sessionDuration`
  - `intervalDuration`
- checklist restore policy is based on `workoutId` identity plus `workoutStructureSignature` when available.
- if the saved workout identity does not match the current workout identity, checklist progress resets.
- if the saved workout identity matches but the saved structure signature differs from the current workout structure, timing can still resume but checklist progress resets.

### Timer Phase Boundary

Authoritative module:
- `src/utils/timerPhase.js`

Current contract:
- warm-up timing is a fixed 15-minute boundary capped by total session length.
- workout-backed header phase labels and speech milestones use that fixed timing boundary.
- timer-only sessions now use a neutral `TIMER ONLY` header label and do not emit speech milestones.
- attached warm-up and cardio routines are checklist content only; they do not currently create timed phases.

### Audio Runtime Boundary

Authoritative modules:
- `src/platform/intervalRuntimeBridge.js`
- `ios/App/App/EliteTimerRuntimePlugin.swift`
- `src/utils/audioManager.js` (web/PWA fallback only)

Current contract:
- `intervalRuntimeBridge` is the only module allowed to decide whether cue ownership is native or web.
- In the Capacitor iPhone shell, `EliteTimerRuntime` owns interval cue scheduling, speech milestone scheduling, mirrored-session persistence, projected-session readback, background-audio keepalive, and playback of the bundled bell/speech assets.
- In web/PWA mode, `audioManager` still owns Web Audio initialization, countdown/bell/speech playback, stalled-playback rebuild recovery, and manual sound recovery.
- In the Capacitor iPhone shell, JS milestone intent may still call into `playSpeechCue`, but that path resolves to native playback and native cue-state tracking rather than Web Audio playback.
- the Timer screen still exposes a subtle icon-only sound-recovery control for active or paused sessions, but this is now primarily a web/PWA fallback behavior.
- manual sound recovery must not reset timer progress or replay missed interval events.

### Workout/Profile Boundary

Authoritative modules:
- `src/utils/workoutStorage.js`
- `src/utils/workoutReadModels.js`
- `src/utils/workoutExerciseSections.js`
- `src/utils/cloudProfileSync.js`
- `src/App.jsx`

Current contract:
- `workoutStorage` remains the canonical client-side profile module for workouts, warm-ups, and cardios.
- App-level `profileRevision` is the refresh signal for Home and Library after:
  - cloud hydration
  - workout CRUD
  - warm-up CRUD
  - cardio CRUD
- screens should prefer explicit read helpers from `workoutReadModels` and `workoutExerciseSections` over reconstructing profile reads independently.

## Current Validation Baseline

Most recent checks run successfully:
- `npm test`
- `npm run lint`
- `npm run build`
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS' -derivedDataPath /tmp/new-timer-xcodebuild CODE_SIGNING_ALLOWED=NO build`

## Latest Field Validation Note

Recent ad hoc physical-iPhone testing by the primary user indicates the current native-owned runtime is materially closer to product validation than the earlier browser-only and first-hybrid slices.

Observed passes in the current build:
- interval bells continued while the phone was locked
- interval bells continued through app switching
- interval bells continued after reopening the app
- interval bells coexisted with Spotify/background music in recent testing
- native speech output is now audibly running on iPhone using the bundled announcement assets

Current interpretation:
- the move from "native audio playback only" to "native cue scheduling plus mirrored-session projection" appears directionally correct
- the speech-path decision is now resolved in favor of native playback for the iPhone shell
- the primary product requirement of trustworthy timing plus dependable interval sound now appears satisfied in recent real-device use, with speech now joining that native runtime path

Remaining caveat:
- this note reflects recent user-observed testing, not yet a formally timed multi-workout validation log
- keep `R3` open until longer real-world runs confirm there are no delayed, duplicated, or missing interval or speech cues over a full workout

Additional note from the current session:
- a focused real-device pass completed successfully for countdown start timing, pause/resume, lock-screen continuation, and app-switch return
- a follow-up real-device bug report revealed duplicate `start_warmup` playback when returning to the app mid-session; that was fixed in the latest March 21 closeout build
- treat this as confidence-building validation, not the final long-run closure of `R3`

## Known Open Risks

These remain active after Tier 1, Tier 2, and the current Tier 3 pass:
- `R2`: Wake Lock variability across browsers/devices.
- `R3`: Physical-iPhone active-session runtime validation remains open; cue scheduling is now native-owned, but long-session lock/app-switch behavior still needs confidence.
- `R4`: Migration semantics ambiguity for canonical workouts.
- `R5`: Local `.netlify/` state drift.
- `R6`: Future docs/tests drift if contract-bearing docs are not updated in the same change set as behavior.
- `R7`: Unauthenticated profile endpoints remain deferred but unresolved.
- `R8`: Eventual-consistency lag in cloud profile reads remains mitigated but not eliminated.

See `docs/risk-register.md` for the current wording and mitigation direction.

## Recommended Next Steps

The next implementation wave should start at Tier 3, not back in Tier 2.

Recommended order from this point:
1. Do not reopen Priorities 1 through 4 unless a concrete regression appears.
2. If the next session is structural cleanup work, start from `docs/plans/2026-03-20-priority-5-deferred-cleanup-plan.md`.
3. If a new runtime bug appears first, treat it as higher priority than structural cleanup.
4. Keep native runtime polish bounded:
   - remove obviously debug-only oddities
   - keep speech native-owned on iPhone; do not move it back to browser-only playback casually
   - continue validating duplicate-free foreground return behavior
5. Continue deferred platform/release concerns separately:
   - endpoint auth gate
   - longer-run `R3` closure
   - broader distribution/testflight work

Why this order:
- the app now has a stable enough operating baseline that cleanup can be intentional instead of reactive
- `workoutStorage.js` is still the largest high-coupling hotspot
- session-state cleanup should build on the now-validated runtime contracts, not compete with them
- endpoint auth and broader release/distribution concerns remain important, but they are not structural-cleanup tasks

Scope note:
- structural cleanup starts from the implemented runtime and sync baseline documented above
- do not reopen the already-implemented build/deploy trust work, device validation scaffolding, timer-screen polish, or sync durability coverage without new evidence

## Suggested Next-Session Reading Order

1. `docs/current-state-handoff.md`
2. `docs/architecture-map.md`
3. `docs/invariants.md`
4. `docs/decision-log.md`
5. `docs/risk-register.md`
6. `docs/test-strategy.md`
7. If working on the iPhone shell, also read:
   - `docs/hybrid-ios-local-runbook.md`
   - `docs/plans/2026-03-20-priority-5-deferred-cleanup-plan.md`
   - `docs/plans/2026-03-19-hybrid-ios-migration-plan.md`

## Notes For The Next Agent

- Do not reopen Tier 1 or Tier 2 unless new evidence shows a regression in the stabilized contracts above.
- Treat `sessionSnapshot`, `sessionResumePolicy`, `timerPhase`, and the `workoutStorage` read helpers as the current Tier 2 baseline.
- Treat the native interval-runtime bridge and mirrored-session reconciliation path as contract-bearing while `R3` remains open; do not move cue authority back into JS casually.
- Treat native speech ownership on iPhone as contract-bearing while `R3` remains open; do not move iPhone speech authority back into Web Audio casually.
- Treat the stalled-playback recovery path and the manual sound-recovery control as contract-bearing for web/PWA mode while `R3` remains open.
- Do not treat attached warm-up/cardio routines as timed phases unless a new product decision is made first.
- If changing persistence or sync behavior, update the contract-bearing docs in the same change set.
