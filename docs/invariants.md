# Invariants

Last updated: March 15, 2026

## Timer Invariants

- Timer status transitions are controlled: `idle -> countdown -> running -> paused -> running -> idle`.
- Session completion must:
  - set status back to `idle`
  - stop ticking
  - release wake lock
  - clear persisted active session state
- Interval count starts at `1` on session start and only increments on interval completion.
- Quick add creates a temporary rest interval (`circleColor = rest`) and then returns to default interval cadence.
- Resume may continue sessions that have already exceeded configured session duration; overtime state is allowed after restore.
- Timer elapsed/remaining values must derive from monotonic runtime timing rather than tick frequency alone.
- Header phase labels and speech milestones use a fixed 15-minute warm-up timing window capped by total session length; attached warm-up/cardio routines do not change that timing boundary.

## Persistence Invariants

- Active session payload (`eliteTimer_activeSession`) is only meaningful when `sessionActive = true`.
- Session duration is persisted in seconds and must match timer configuration for timing resume.
- Exercise progress persistence is best-effort and tied to active sessions.
- Saved session metadata is limited to workout identity (`workoutId`, `workoutName`) and checklist progress.
- Saved checklist progress is restored only when saved workout identity matches the current workout identity; otherwise the checklist resets.
- Settings payload (`eliteTimer_settings`) currently contains only `sessionMinutes` and `intervalSeconds`.
- Settings normalization clamps numeric values into supported bounds and falls back to defaults for non-numeric values.
- Storage read/write failures must fail safely without crashing app startup.
- Workout profile boot hydration is best-effort and runs without blocking first interactive screen render.
- Workout profile writes must update local cache first, then queue debounced cloud sync writes.
- Cloud profile timestamps (`eliteTimer_profile_updated_at` vs remote `updatedAt`) determine local-vs-remote winner on boot.
- Cloud profile merge ordering is section-based for `workouts`, `warmups`, and `cardios`; a stale section patch must not overwrite newer data in another section.
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
- Timer UI must remain fully operable through countdown, running, paused, resume, and completion flows.

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
