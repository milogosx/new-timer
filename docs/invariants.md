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
- Battery saver mode may reduce visual effects and tick cadence, but timer elapsed/remaining values must still derive from monotonic runtime timing.

## Persistence Invariants

- Active session payload (`eliteTimer_activeSession`) is only meaningful when `sessionActive = true`.
- Session duration is persisted in seconds and must match timer configuration for timing resume.
- Exercise progress persistence is best-effort and tied to active sessions.
- Storage read/write failures must fail safely without crashing app startup.
- Workout profile boot hydration is best-effort and runs without blocking first interactive screen render.
- Workout profile writes must update local cache first, then queue debounced cloud sync writes.
- Cloud profile timestamps (`eliteTimer_profile_updated_at` vs remote `updatedAt`) determine local-vs-remote winner on boot.
- Failed cloud writes must be retried; they must not be silently discarded.

## Workout Data Invariants

- Workouts, warm-ups, and cardios are arrays of records.
- Each record must have a stable `id` and at least one normalized exercise.
- Exercise records must have normalized numeric fields:
  - `sets >= 1`
  - `rest >= 0`
- Deleting warm-ups or cardios must remove orphaned references from workouts.
- Schema version keys are the migration contract and must be updated atomically with data writes.
- Deleted canonical defaults are tracked via tombstone keys and must not be auto-reinserted on load.

## UI/Theme Invariants

- Theme source of truth is `<html data-theme="dark|light">` plus `er-timer-theme`.
- Theme switch must update browser `meta[name="theme-color"]`.
- Home, Timer, Library, and Editors must remain operable in both themes.
- Timer UI must remain fully operable when battery saver mode is enabled.

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
