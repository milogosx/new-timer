# Architecture Map

Last updated: March 15, 2026

## System Boundaries

- Client-first React application with Netlify serverless profile sync.
- Workout profile persistence is Netlify Blobs (via Functions) with local cache fallback.
- Browser APIs used: Web Audio, Wake Lock, vibration, visibility events.
- Build/deploy: Vite build output (`dist`) + Netlify publish + Netlify Functions.

## Runtime Topology

```mermaid
flowchart TD
  A["src/main.jsx"] --> B["src/App.jsx (screen + theme shell)"]
  B --> C["HomeScreen"]
  B --> D["TimerScreen"]
  B --> E["WorkoutLibrary"]
  B --> F["WorkoutEditor / WarmupEditor / CardioEditor"]
  D --> G["useTimer hook"]
  D --> N["exerciseProgress + sessionResumePolicy + timerPhase + workoutExerciseSections helpers"]
  G --> H["timerLogic + timerTickMath + sessionSnapshot + storage + wakeLock + audioManager"]
  C --> I["storage + workoutStorage + workoutReadModels + cloudProfileSync + audioManager"]
  E --> J["workoutStorage + cloudProfileSync"]
  E --> R["workoutReadModels"]
  F --> O["exerciseSanitizer helpers"]
  F --> J
  F --> R["workoutReadModels"]
  J --> K["localStorage cache (workouts/warmups/cardios + schema keys)"]
  P["profile-read/profile-write Functions"] --> Q["Netlify Blobs profile store"]
  I --> P
  J --> P
  H --> L["localStorage (active session/settings)"]
```

## Data Flow

- Session start:
  - Home screen reads settings/workout templates from storage.
  - `cloudProfileSync` hydrates workout profile from Netlify (if reachable) in background.
  - App increments `profileRevision` after profile writes or cloud hydration so Home/Library remount against current local storage.
  - App passes selected session config to Timer screen.
  - Timer screen initializes exercise progress and timer hook.
- Active session:
  - `useTimer` maintains timing state, interval progression, wake lock, and running-session persistence cadence.
  - Timer screen owns checklist progress; `sessionResumePolicy` defines the persisted workout identity metadata and checklist restore behavior.
  - `timerPhase` defines a fixed 15-minute warm-up timing window for header labels and speech milestones; attached warm-up/cardio routines remain checklist content, not timed phases.
- Resume flow:
  - Timer screen reads saved session.
  - `useTimer.resumeSession` reconstructs timing state using saved payload and derivation logic.
  - `sessionResumePolicy` decides timing compatibility, workout identity matching, and whether saved checklist progress is restored or reset.
- Content management:
  - Library/editors perform CRUD via `workoutStorage`.
  - `workoutReadModels` now exposes explicit read models for Library and WorkoutEditor (`loadWorkoutLibraryData`, `loadWorkoutAttachmentOptions`) so screens do not each reconstruct profile reads independently.
  - Migration/upsert logic runs during load and updates schema version keys in local cache.
  - Save operations queue debounced profile writes to Netlify Functions (write-through sync).
  - Cloud merge ordering now resolves conflicts per section (`workouts`, `warmups`, `cardios`) using section-level timestamps, so an older update in one section does not overwrite newer data in another.
  - Default-entity deletions are tracked as tombstone ID lists to prevent default resurrection.
  - Retry/lifecycle flush handlers (`online`, `visibilitychange`, `pagehide`) improve write durability.

## State Ownership

- App shell state (`screen`, editor context, theme): `src/App.jsx`.
- Timer runtime state machine: `src/hooks/useTimer.js`.
- Exercise checklist state for current view: `src/components/TimerScreen.jsx`.
- Timer workout section derivation for current view: `src/utils/workoutExerciseSections.js`.
- Saved-session compatibility and checklist restore policy: `src/utils/sessionResumePolicy.js`.
- Fixed session-phase timing policy: `src/utils/timerPhase.js`.
- Workouts/warmups/cardios and schemas: `src/utils/workoutStorage.js`.
- Screen-facing workout sorting and attachment/library read models: `src/utils/workoutReadModels.js`.
- Cloud profile hydration/write queue: `src/utils/cloudProfileSync.js`.
- Netlify profile endpoints: `netlify/functions/profile-read.js`, `netlify/functions/profile-write.js`.
- Cloud merge/conflict policy: `netlify/profileStore.js`.
- Session/settings persistence: `src/utils/storage.js`.
- Screen flow constants: `src/constants/appState.js`.

## Extension Points

- Add screen flows by extending App screen switch and route handlers.
- Add timer behaviors inside `useTimer` while preserving invariants.
- Keep timer math/persistence payload shaping in pure helpers (`timerTickMath`, `sessionSnapshot`).
- Add persistence fields through `storage.js` and migration-safe readers.
- Add workout entity fields by normalizing defaults and migration handlers in `workoutStorage.js`.
