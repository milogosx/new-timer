# Test Strategy

Last updated: February 15, 2026

## Test Pyramid

- Unit tests (primary):
  - timer derivation and formatting (`src/utils/timerLogic.js`)
  - storage/migration contracts (`src/utils/workoutStorage.js`)
  - cloud profile merge ordering contracts (`netlify/profileStore.js`)
  - deterministic waveform geometry (`src/utils/ecgWaveform.js`)
  - session cadence and resume policy contracts (`src/utils/sessionPersistenceCadence.js`, `src/utils/sessionResumePolicy.js`)
- Integration-focused unit tests (targeted additions):
  - timer lifecycle transitions in `useTimer` (partially covered via resume-status/cadence contracts)
  - resume-session matching logic in `TimerScreen` (`sessionResumePolicy` coverage)
- E2E smoke (minimal, production build):
  - `scripts/e2e-smoke.mjs` validates start -> pause -> resume -> reset on Chromium
- Manual smoke tests (required for UI/browser API behavior):
  - wake lock indicators
  - audio unlock behavior
  - theme persistence and splash behavior
  - cloud profile hydrate/write behavior (Netlify deploy)

## Browser/Device Support Matrix

| Capability | Baseline target | Expected behavior |
|---|---|---|
| Core timer UI | Modern mobile Safari, modern Chromium mobile | Full support |
| Wake Lock API | Chromium mobile (supported), Safari mobile (limited) | Use wake lock when available; no crash when unavailable |
| Audio autoplay policies | Safari/Chromium mobile | Audio unlock via user interaction; fallback to silent-safe behavior |
| Vibration/haptics | Device/browser dependent | Best-effort only, no hard dependency |

## Wake Lock + Audio QA Checklist

- Device setup:
  - ensure volume is on and device is not in silent-only testing mode
  - disable low-power restrictions where possible for consistency
- Wake lock checks:
  - start session and confirm lock indicator appears while active
  - background app for ~20s and return; timer catches up and app remains usable
  - verify no crash or stuck UI when wake lock is unsupported/denied
- Audio checks:
  - first user interaction unlocks audio pathway
  - countdown beeps play during start sequence
  - interval bell plays on interval boundaries
  - background music toggle on/off updates immediately and persists across reload
- Resume checks:
  - paused session reload restores paused state
  - running session reload restores running state
  - mismatched session config shows safe discard path
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
- CI gate: GitHub Actions workflow (`.github/workflows/ci.yml`) runs `lint`, `test`, and `build` on pushes/PRs.
- Refactor gate: keep both green before and after structure-only changes.

## When To Add Tests

- Any change to timer progression/resume logic.
- Any schema version bump or normalization change.
- Any change to cloud profile payload/merge rules.
- Any change to session persistence payload shape.
- Any bug fix touching production behavior (add regression test first where feasible).

## Known Gaps

- E2E currently covers one primary happy-path flow (Chromium only).
- Cloud profile sync client behavior is still primarily validated manually (limited automated coverage on browser lifecycle events).
- No automated performance regression checks for persistence cadence.
- Wake lock/audio behavior still depends on manual cross-device verification.
- Hook-level timer lifecycle transitions still rely mostly on unit contracts and manual smoke (no dedicated hook test harness yet).
