# Elite Recomposition Timer

Mobile-first workout timer app built with React + Vite.  
It runs fully client-side (no backend), with local persistence for workouts, session state, theme, and audio preferences.

## Purpose

- Start timed interval sessions with or without a workout template.
- Attach reusable warm-up and cardio routines to workouts.
- Track per-exercise/per-set completion during a session.
- Resume interrupted active sessions from local state.

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
- `src/utils/storage.js`: session/settings/audio preference persistence.
- `src/utils/workoutStorage.js`: workouts/warm-ups/cardio CRUD + schema migration.
- `src/utils/audioManager.js`: bell/countdown SFX + procedural background music.
- `src/utils/wakeLock.js`: Wake Lock integration.

## State Ownership (High Level)

- App shell state (`screen`, theme, edit context): `src/App.jsx`
- Timer runtime state: `src/hooks/useTimer.js`
- Exercise checklist progress for current session: `src/components/TimerScreen.jsx`
- Workout/warm-up/cardio data: `localStorage` via `src/utils/workoutStorage.js`

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

## Deploy Caveats

- Netlify config currently lives in `.netlify/netlify.toml` with:
  - build command: `npm run build`
  - publish dir: `dist` (portable repo-relative path)
- `.netlify/` can include Netlify-generated local state; treat it as environment tooling output and review before committing unrelated changes.

## Current Health Status

Verified on **February 15, 2026**:

- `npm run lint`: passing
- `npm test`: passing (13/13)

This status reflects the current branch state and should be re-verified after behavior changes.
