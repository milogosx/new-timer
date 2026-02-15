# Invariants

Last updated: February 15, 2026

## Timer Invariants

- Timer status transitions are controlled: `idle -> countdown -> running -> paused -> running -> idle`.
- Session completion must:
  - set status back to `idle`
  - stop ticking
  - release wake lock
  - clear persisted active session state
- Interval count starts at `1` on session start and only increments on interval completion.
- Quick add creates a temporary rest interval (`circleColor = rest`) and then returns to default interval cadence.
- Resume must not continue sessions that have already exceeded configured session duration.

## Persistence Invariants

- Active session payload (`eliteTimer_activeSession`) is only meaningful when `sessionActive = true`.
- Session duration is persisted in seconds and must match timer configuration for timing resume.
- Exercise progress persistence is best-effort and tied to active sessions.
- Storage read/write failures must fail safely without crashing app startup.

## Workout Data Invariants

- Workouts, warm-ups, and cardios are arrays of records.
- Each record must have a stable `id` and at least one normalized exercise.
- Exercise records must have normalized numeric fields:
  - `sets >= 1`
  - `rest >= 0`
- Deleting warm-ups or cardios must remove orphaned references from workouts.
- Schema version keys are the migration contract and must be updated atomically with data writes.

## UI/Theme Invariants

- Theme source of truth is `<html data-theme="dark|light">` plus `er-timer-theme`.
- Theme switch must update browser `meta[name="theme-color"]`.
- Home, Timer, Library, and Editors must remain operable in both themes.

## How To Validate

- Automated:
  - `npm run lint`
  - `npm test`
- Manual smoke:
  - start/pause/resume/reset session
  - quick add rest interval
  - active session resume/discard
  - workout create/edit/delete
  - warm-up/cardio attach and delete reference cleanup
  - theme toggle persistence across reload
