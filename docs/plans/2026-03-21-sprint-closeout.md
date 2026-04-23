# March 21 Sprint Closeout

Last updated: March 21, 2026

## Summary

This sprint focused on understanding the current app/runtime state, tightening the storage boundary, and making iPhone speech output reliable without regressing the bell baseline.

The sprint ended with:
- the first bounded `workoutStorage.js` seam extraction completed
- native-owned iPhone speech playback and scheduling implemented using the existing bundled voice assets
- a follow-up fix for duplicate `start_warmup` replay when returning to the app during an active session
- passing local validation for lint, build, tests/E2E earlier in the sprint, and final native build + simulator smoke after the latest speech fix

## Key Product Decisions

### 1. Native iPhone speech should preserve the historical voice

- The iPhone shell should play the existing bundled `.mp3` announcements, not synthesized text-to-speech.
- Rationale: the primary user wants the voice output to sound the same as it has historically.

### 2. Speech reliability should follow the same runtime model as the bell

- In the native iPhone shell, speech must be scheduled and played natively so it can survive lock-screen and app-switch conditions.
- Web Audio fallback remains appropriate for web/PWA mode, but not as the primary iPhone speech path.

### 3. Bell behavior remains the non-negotiable baseline

- Speech must coexist with the bell smoothly and must not delay, replace, or suppress interval bells.
- The native plugin uses separate playback nodes for bell and speech while sharing the same native audio runtime.

### 4. The current app is still treated as single-user/trusted use

- The current user clarified that the app is for personal use.
- Auth for profile endpoints remains deferred until broader sharing/distribution becomes a real goal.

## Key Technical Decisions

### Native speech architecture

- `ios/App/App/EliteTimerRuntimePlugin.swift` now owns iPhone-native speech asset loading, milestone scheduling, and playback.
- `src/platform/intervalRuntimeBridge.js` remains the only boundary allowed to decide whether audio ownership is native or web.
- `src/utils/audioManager.js` remains the speech path for web/PWA mode.

### Foreground behavior on iPhone

- `TimerScreen` still emits milestone intent from JS, but in the iPhone shell that routes to native playback.
- Native scheduling remains authoritative for background/lock reliability.
- This gives a safe foreground assist path without depending on WKWebView audio as the playback backend.

### Mirrored-session speech memory

- Native speech cue state must survive repeated `upsertSession` calls from the React timer loop.
- Stored-session catch-up logic must only run when truly restoring an existing native session, not during every live mirror refresh.
- Same-session merge logic now tolerates small timestamp drift so a foreground return does not re-arm `start_warmup`.

## Validation Snapshot

Passed during the sprint:
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npm run ios:build`
- `npm run ios:sim-smoke`

Field observations from the primary user:
- native speech output is now audibly running on iPhone
- the duplicate speech-on-return bug was reproduced from logs, localized, and patched in the latest closeout build

## Remaining Open Items

- Keep `R3` open until a longer physical-iPhone run confirms:
  - no missed interval bells
  - no delayed interval bells
  - no duplicate speech cues on repeated background/foreground transitions
  - continued coexistence with background audio (for example Spotify)
- Auth remains deferred until broader sharing is desired.
- Structural cleanup beyond the completed `workoutStorage` seam should stay bounded and should not reopen runtime trust work without a fresh bug.

## Recommended Start For The Next Session

1. Use the current handoff docs, not chat history, as the source of truth.
2. If no new runtime bug appears, start from the deferred cleanup plan.
3. If a new native runtime bug appears, treat it as higher priority than structural cleanup.
