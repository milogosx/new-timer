# Hybrid iOS Local Runbook

Last updated: March 20, 2026

## Purpose

Run the hybrid iPhone shell locally while keeping workout/profile sync on Netlify.

## Required Environment

Create a local `.env` file with:

```bash
VITE_PROFILE_SYNC_BASE_URL=https://YOUR-NETLIFY-SITE.netlify.app
```

Why:

- the native shell loads bundled web assets from `capacitor://localhost`
- relative `/.netlify/functions/*` URLs will not reach Netlify from that origin
- the hybrid shell therefore needs an explicit HTTPS base URL for profile sync

## Commands

Install dependencies:

```bash
npm install
```

Build web assets and sync them into the iOS shell:

```bash
npm run ios:sync
```

Important:

- `npm run ios:sync` is the step that refreshes the bundled React app inside the iPhone shell
- pressing Run in Xcode without syncing first can reinstall a stale JS bundle
- if app behavior looks unchanged, assume stale assets before assuming the code fix failed

Open the Xcode project:

```bash
npm run ios:open
```

Optional preflight smoke on a local iPhone simulator:

```bash
npm run ios:sim-smoke
```

What it checks:

- rebuilds and syncs the bundled web assets
- boots an iPhone simulator
- builds, installs, and launches the native shell
- captures a screenshot plus launch logs for build verification

What it does not replace:

- lock-screen validation
- real background audio survival
- final bell/haptic judgment on a physical iPhone

Best practice going forward:

- use the simulator as the default source of truth for visual/layout review and day-to-day QA on mobile-facing changes
- use browser validation as a quick secondary loop when you need faster iteration, not as the final sign-off environment
- use a physical iPhone when validating lock-screen behavior, background continuation, bells, speech, haptics, or anything dependent on iOS device policy

## Xcode Steps

1. Open `ios/App/App.xcodeproj`.
2. If Xcode reports missing iOS platform or Simulator components, install them from `Xcode > Settings > Components`.
3. Select the `App` target.
4. Set your signing team under `Signing & Capabilities`.
5. Choose either:
   - an attached iPhone
   - an installed iOS Simulator runtime
6. Press Run.
7. Verify the `[build]` boot log in Xcode before testing behavior:
   - confirm the short git SHA matches the commit you expect
   - confirm the bundle filename changed after a fresh `ios:sync` when JS changed
   - confirm the runtime says `native-shell` on device
8. If the `[build]` log is stale:
   - stop the app in Xcode
   - rerun `npm run ios:sync`
   - press Run again
   - do not debug timer behavior until the boot log matches

## What Netlify Still Does

- serves the web/PWA version if you still want one
- hosts the profile sync endpoints
- remains out of the critical timer/audio path during an active workout

## Current Native Scope

The hybrid shell currently includes:

- Capacitor iOS container
- native `EliteTimerRuntime` bridge/plugin
- native session mirroring
- native interval cue scheduling
- background-audio keepalive
- projected-session readback for foreground catch-up

The current goal is to prove bell reliability first. Speech remains secondary and still falls back to web behavior today.
