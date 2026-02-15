# Test Strategy

Last updated: February 15, 2026

## Test Pyramid

- Unit tests (primary):
  - timer derivation and formatting (`src/utils/timerLogic.js`)
  - storage/migration contracts (`src/utils/workoutStorage.js`)
  - deterministic waveform geometry (`src/utils/ecgWaveform.js`)
- Integration-focused unit tests (targeted additions):
  - timer lifecycle transitions in `useTimer`
  - resume-session matching logic in `TimerScreen`
- Manual smoke tests (required for UI/browser API behavior):
  - wake lock indicators
  - audio unlock behavior
  - theme persistence and splash behavior

## Critical Behavior Matrix

| Area | Must-pass checks |
|---|---|
| Timer lifecycle | start, pause, resume, reset, complete |
| Resume | restore active session when config matches; safe discard otherwise |
| Interval logic | interval count/color progression; quick add rest handling |
| Data migration | legacy content migration and schema version updates |
| Content CRUD | workout/warm-up/cardio create, edit, delete, reference cleanup |
| Theme | toggle persistence + correct `data-theme` and `theme-color` behavior |

## Data/Migration Test Rules

- Prefer explicit fixtures for legacy schemas.
- Assert both resulting data shape and schema key updates.
- Add tests before changing migration semantics.

## Tooling and Gates

- Lint gate: `npm run lint`
- Test gate: `npm test`
- Refactor gate: keep both green before and after structure-only changes.

## When To Add Tests

- Any change to timer progression/resume logic.
- Any schema version bump or normalization change.
- Any change to session persistence payload shape.
- Any bug fix touching production behavior (add regression test first where feasible).

## Known Gaps

- No full E2E browser automation yet.
- No automated performance regression checks for persistence cadence.
- Wake lock/audio behavior still depends on manual cross-device verification.
