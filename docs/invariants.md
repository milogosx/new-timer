# Invariants

Last updated: April 21, 2026

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
- Timer elapsed/remaining values must derive from persisted session timing and deterministic interval math rather than tick frequency alone.
- When the native iPhone runtime is available, JS may render timer state but must not be the authoritative owner of interval cue scheduling.
- Workout-backed header phase labels and speech milestones use a fixed 15-minute warm-up timing window capped by total session length; timer-only sessions use a neutral header label and do not emit speech milestones. Attached warm-up/cardio routines do not change that timing boundary.

## Audio Invariants

- The iPhone-native runtime in `ios/App/App/EliteTimerRuntimePlugin.swift` is the authoritative cue scheduler when the Capacitor shell is present.
- The web/PWA fallback audio runtime in `src/utils/audioManager.js` remains the authoritative cue scheduler only when no native runtime is present.
- Native cue ownership requires interval scheduling, background-audio keepalive, mirrored-session persistence, and projected-session readback to move together.
- Native session projection must not rewind interval count, interval state, or elapsed timing when the app returns from background.
- Audio keepalive, visibility recovery, and manual sound recovery must fail safely without crashing timer startup or active-session progression.
- Manual sound recovery must not reset timer elapsed time, interval count, or checklist progress; it only re-primes future audio cues.
- Voice pack synthesis is reproducible: `audio-manifest/voice-pack.json` lists every slug; `audio-manifest/render.py` pins profile (`bright`/`af_bella`) and speed (`0.9`). Rendered WAVs live in `audio-manifest/rendered/` and are copied to both bundles by `npm run voice-pack:sync`, which must verify parity across manifest, renders, `speechCueCatalog.js`, and `EliteTimerRuntimePlugin.swift` before copying.
- Coaching schedule is generated once per session at the idle/countdown → running transition via `buildCoachingSchedule(sessionMinutes, seed)`. It is embedded in session metadata as `coachingSchedule: [{key, at}, ...]` and consumed (not re-derived) by the native plugin.
- Coaching cues must not fire within `COACHING_DEADZONE_SEC` of any structural milestone and must not fire before `t = COACHING_DEADZONE_SEC`.
- Mute toggle gates playback only. Timer progression, interval counting, schedule advancement, and "played-key" bookkeeping must continue unchanged while muted, on both the JS bridge and native plugin.
- Completion overlay surfaces only when stop/reset happens after elapsed has reached configured session duration. Early resets must not surface completion.

## Persistence Invariants

- Active session payload (`eliteTimer_activeSession`) is only meaningful when `sessionActive = true`.
- The native mirrored session store must carry the same workout identity metadata boundary as local storage and must stay JSON-serializable.
- Session duration is persisted in seconds and must match timer configuration for timing resume.
- Exercise progress persistence is best-effort and tied to active sessions.
- Saved session metadata is limited to workout identity (`workoutId`, `workoutName`), optional workout structure signature, checklist progress, and a per-session `speechEnabled` flag for native/runtime parity.
- Saved checklist progress is restored only when saved workout identity matches the current workout identity.
- When a saved workout structure signature is present, checklist progress is restored only when that signature matches the current workout structure; otherwise timing may resume but the checklist resets.
- When both local web storage and native mirrored storage contain active sessions, the fresher session snapshot wins.
- Settings payload (`eliteTimer_settings`) contains separate `workoutDefaults` and `timerOnlyDefaults` presets.
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
  - in the native iPhone shell, lock phone / switch apps / return during an active session and confirm interval bells keep firing while backgrounded and the UI catches up correctly on foreground return
  - in web/PWA mode, confirm bells/speech still recover, or the manual sound-recovery control restores future cues without altering timer progress
  - workout create/edit/delete
  - warm-up/cardio attach and delete reference cleanup
  - theme toggle persistence across reload
