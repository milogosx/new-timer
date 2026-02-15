# Elite Recomposition Timer

Mobile-first workout timer app built with React + Vite.  
It is client-first, with Netlify-backed profile sync for workouts/warm-ups/cardios and local fallback for session state, theme, and audio preferences.

## Purpose

- Start timed interval sessions with or without a workout template.
- Attach reusable warm-up and cardio routines to workouts.
- Track per-exercise/per-set completion during a session.
- Resume interrupted active sessions from local state.
- Persist workout-library edits as your default profile across devices via Netlify Functions + Blobs.

## Local Setup

Requirements:

- Node.js 20+ recommended
- npm

Install and run:

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm run preview
```

## Architecture Snapshot

Entry points:

- `src/main.jsx`: React mount (`StrictMode`).
- `src/App.jsx`: top-level screen routing and shared app shell state.

Primary layers:

- `src/components/*`: screen and UI components.
- `src/hooks/useTimer.js`: core timer state machine (countdown/running/paused/resume).
- `src/hooks/useBackgroundMusicState.js`: shared BGM state subscription for Home/Timer screens.
- `src/utils/storage.js`: session/settings/audio preference persistence.
- `src/utils/workoutStorage.js`: workouts/warm-ups/cardio CRUD + schema migration.
- `src/utils/cloudProfileSync.js`: boot-time profile hydrate + write-through cloud sync for workout entities.
- `src/utils/sessionSnapshot.js`: pure session payload construction for persistence.
- `src/utils/timerTickMath.js`: pure timer interval fast-forward math.
- `src/utils/exerciseProgress.js`: checklist progress normalization/toggle helpers.
- `src/utils/exerciseSanitizer.js`: shared editor save-time exercise normalization.
- `src/utils/audioManager.js`: bell/countdown SFX + procedural background music.
- `src/utils/wakeLock.js`: Wake Lock integration.
- `src/constants/appState.js`: app screen and editor-return constants.
- `netlify/functions/profile-read.js`: reads persisted workout profile.
- `netlify/functions/profile-write.js`: writes merged workout profile updates.

## State Ownership (High Level)

- App shell state (`screen`, theme, edit context): `src/App.jsx`
- Timer runtime state: `src/hooks/useTimer.js`
- Exercise checklist progress for current session: `src/components/TimerScreen.jsx`
- Workout/warm-up/cardio canonical profile: Netlify Blobs via `netlify/functions/*` + local cache in `src/utils/workoutStorage.js`

## Local Storage Keys

Theme:

- `er-timer-theme`

Session/settings/audio:

- `eliteTimer_activeSession`
- `eliteTimer_settings`
- `eliteTimer_audioPrefs`

Workout data:

- `eliteTimer_workouts`
- `eliteTimer_warmups`
- `eliteTimer_cardios`

Schema versions:

- `eliteTimer_workouts_schema`
- `eliteTimer_warmups_schema`
- `eliteTimer_cardios_schema`
- `eliteTimer_profile_updated_at`
- `eliteTimer_deletedDefaultWorkoutIds`
- `eliteTimer_deletedDefaultWarmupIds`
- `eliteTimer_deletedDefaultCardioIds`

## Cloud Profile Sync

- Read endpoint: `/.netlify/functions/profile-read`
- Write endpoint: `/.netlify/functions/profile-write`
- Storage backend: Netlify Blobs store (`elite-timer-profiles`)
- Profile scope:
  - defaults to single profile id `solo`
  - optional override with env var `ELITE_TIMER_PROFILE_ID` in Netlify site settings

Behavior:

- On app boot, cloud profile sync runs in the background and hydrates local workout data when available.
- Local workout edits queue cloud writes (debounced) so changes become your new defaults.
- If cloud is unreachable, app keeps working with local data only.

## Deploy Caveats

- Netlify config currently lives in `netlify.toml` with:
  - build command: `npm run build`
  - publish dir: `dist` (portable repo-relative path)
- Netlify Functions are expected in `netlify/functions` and are required for cross-device workout profile persistence.
- Running `npm run dev` (Vite only) does not serve Netlify Functions; cloud sync falls back to local-only behavior in that mode.
- `.netlify/` is local Netlify state and is intentionally gitignored.

## Current Health Status

Verified on **February 15, 2026**:

- `npm run lint`: passing
- `npm test`: passing (23/23)
- `npm run build`: passing

This status reflects the current branch state and should be re-verified after behavior changes.
