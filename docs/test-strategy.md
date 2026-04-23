# Test Strategy

Last updated: March 22, 2026

## Test Pyramid

- Unit tests (primary):
  - timer derivation and formatting (`src/utils/timerLogic.js`)
  - fixed timer-phase and speech-milestone policy (`src/utils/timerPhase.js`)
  - storage/migration contracts (`src/utils/workoutStorage.js`)
  - cloud profile merge ordering contracts, including section-level conflict handling (`netlify/profileStore.js`)
  - client cloud profile hydrate/requeue contracts (`src/utils/cloudProfileSync.js`)
  - deterministic waveform geometry (`src/utils/ecgWaveform.js`)
  - session cadence and resume policy contracts (`src/utils/sessionPersistenceCadence.js`, `src/utils/sessionResumePolicy.js`)
- Integration-focused unit tests (targeted additions):
  - timer lifecycle transitions in `useTimer` (partially covered via resume-status/cadence contracts)
  - resume-session matching logic in `TimerScreen` (`sessionResumePolicy` coverage)
- E2E smoke (minimal, production build):
  - `scripts/e2e-smoke.mjs` validates start -> pause -> resume -> reset on Chromium
- Manual smoke tests (required for UI/browser API behavior):
  - simulator-first visual QA for mobile-facing UI changes
  - wake lock indicators
  - interval cue ownership behavior in native iPhone shell vs web/PWA fallback
  - theme persistence and splash behavior
  - cloud profile hydrate/write behavior (Netlify deploy)

## Browser/Device Support Matrix

| Capability | Baseline target | Expected behavior |
|---|---|---|
| Core timer UI | Modern mobile Safari, modern Chromium mobile | Full support |
| Native iPhone shell | Capacitor + physical iPhone | Native cue scheduling, background-audio keepalive, mirrored-session catch-up |
| Wake Lock API | Chromium mobile (supported), Safari mobile (limited) | Prefer native wake lock when available; fallback to `nosleep.js` keep-awake path on Safari/iPhone |
| Audio autoplay policies | Safari/Chromium mobile | Audio unlock via user interaction; fallback to silent-safe behavior |
| Vibration/haptics | Device/browser dependent | Best-effort only, no hard dependency |

## Wake Lock + Audio QA Checklist

- Device setup:
  - ensure volume is on and device is not in silent-only testing mode
  - disable low-power restrictions where possible for consistency
- Wake lock checks:
  - start session and confirm lock indicator appears while active
  - repeat on both dark and light theme to confirm no theme-coupled regressions
  - background app for ~20s and return; timer catches up and app remains usable
  - verify no crash or stuck UI when wake lock is unsupported/denied
- Audio checks:
  - in web/PWA mode, first user interaction unlocks the audio pathway
  - countdown beeps play during start sequence
  - interval bell plays on interval boundaries
  - milestone speech announcements play at their configured thresholds when audio is available
  - in the native iPhone shell, lock or app-switch during a long session and confirm interval bells continue while backgrounded
  - in the native iPhone shell, return to foreground and confirm timer UI catches up to the projected native session without replaying missed bells from JS
  - in the native iPhone shell, verify Spotify/background audio can coexist without permanently suppressing interval bells
  - in web/PWA mode, if cues stop during a physical-iPhone run, tap the subtle sound-recovery icon and confirm the recovery chirp plays and later bells/speech resume without resetting timer progress
  - web hidden-state playback checks must verify that stalled cues do not permanently kill future audio; the next readiness check or manual recovery should restore subsequent playback
- Resume checks:
  - paused session reload restores paused state
  - running session reload restores running state
  - mismatched session config shows safe discard path
  - same workout id with changed exercise/attachment structure resumes timing but resets checklist progress
- Cloud sync checks:
  - edit workout name on device A, reload on device B, verify update appears as default
  - delete canonical default workout (e.g., `default-engine`), reload, verify it does not reappear
  - edit warm-up/cardio exercises on mobile, reload app, verify persistence
  - temporarily block network, save local edit, restore network, verify next online boot preserves latest profile winner by timestamp

## Critical Behavior Matrix

| Area | Must-pass checks |
|---|---|
| Timer lifecycle | start, pause, resume, reset, complete |
| Resume | restore active session when config matches; safe discard otherwise |
| Interval logic | interval count/color progression; quick add rest handling |
| Data migration | legacy content migration and schema version updates |
| Content CRUD | workout/warm-up/cardio create, edit, delete, reference cleanup |
| Cloud profile sync | boot hydrate, local-write then cloud-sync, fail-safe local fallback |
| Theme | toggle persistence + correct `data-theme` and `theme-color` behavior |

## Data/Migration Test Rules

- Prefer explicit fixtures for legacy schemas.
- Assert both resulting data shape and schema key updates.
- Add tests before changing migration semantics.

## Tooling and Gates

- Lint gate: `npm run lint`
- Test gate: `npm test`
- E2E smoke gate (local/CI): `npm run test:e2e`
- iOS simulator smoke gate (local): `npm run ios:sim-smoke`
- CI gate: GitHub Actions workflow (`.github/workflows/ci.yml`) runs `lint`, `test`, and `build` on pushes/PRs.
- Refactor gate: keep both green before and after structure-only changes.
- Runtime validation checklist: [native-runtime-validation-checklist.md](./native-runtime-validation-checklist.md)
- Preferred manual QA order for mobile UI work:
  - iPhone simulator first for layout, spacing, tap targets, and flow review
  - browser second for fast iteration if needed
  - physical iPhone last for background/audio/haptic/runtime confidence

## When To Add Tests

- Any change to timer progression/resume logic.
- Any schema version bump or normalization change.
- Any change to cloud profile payload/merge rules.
- Any change to session persistence payload shape.
- Any bug fix touching production behavior (add regression test first where feasible).

## Known Gaps

- E2E currently covers one primary happy-path flow (Chromium only).
- iOS simulator smoke now covers bundle sync, install, launch, and screenshot evidence, but not hardware-faithful runtime behavior.
- Cloud profile sync browser lifecycle events are still primarily validated manually.
- No automated performance regression checks for persistence cadence.
- Wake lock/audio behavior still depends on manual cross-device verification.
- Native interval-runtime validation still depends on real-device behavior under lock/app-switch transitions; simulator-only validation is insufficient.
- The current native scheduler and projected-session reconciliation paths have compile coverage plus manual validation, but closure of `R3` still requires a long physical-iPhone session with lock/app-switch transitions.
- Hook-level timer lifecycle transitions still rely mostly on unit contracts and manual smoke (no dedicated hook test harness yet).
