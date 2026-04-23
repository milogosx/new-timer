# Decision Log

Last updated: April 21, 2026

## ADR-Style Entry Format

- ID
- Date
- Decision
- Context
- Alternatives considered
- Consequence
- Status (`accepted`, `implemented`, `superseded`)

## Decisions

### D-001

- Date: 2026-02-15
- Decision: Canonical workouts are user-editable defaults after first load.
- Context: Existing migration behavior preserves edits to canonical IDs.
- Alternatives considered: enforce immutable canonical defaults on every load.
- Consequence: Better user trust/customization, but baseline updates require explicit migration strategy.
- Status: accepted

### D-002

- Date: 2026-02-15
- Decision: Active-session persistence should be throttled (target ~1s cadence) plus transition-based writes.
- Context: Current per-frame persistence increases performance/battery risk.
- Alternatives considered: keep per-frame writes; persist only on pause/stop.
- Consequence: Reduced write load with small tradeoff in worst-case progress loss window.
- Status: implemented

### D-003

- Date: 2026-02-15
- Decision: Support baseline is modern mobile Safari + modern Chromium mobile, with graceful degradation.
- Context: Wake lock/audio policies vary by browser/device.
- Alternatives considered: broad legacy support guarantees; single-browser optimization.
- Consequence: Clear product expectation and simpler compatibility model.
- Status: implemented

### D-004

- Date: 2026-02-15
- Decision: Netlify config is portable and in-repo.
- Context: Machine-specific absolute path created deploy fragility.
- Alternatives considered: environment-local config only.
- Consequence: Reproducible deploy behavior; requires avoiding local state leakage in commits.
- Status: implemented

### D-005

- Date: 2026-02-15
- Decision: Workout defaults persist via Netlify Blobs profile sync (Functions-backed), with local cache fallback.
- Context: Sole-user editing across devices requires durable defaults without hardcoding and without relying only on browser-local storage.
- Alternatives considered: localStorage only; external hosted database.
- Consequence: Cross-device durability improves immediately; introduces serverless dependency and endpoint-hardening risk.
- Status: implemented

### D-006

- Date: 2026-02-15
- Decision: Canonical workout/warm-up/cardio deletions are persisted as tombstone ID lists.
- Context: Canonical defaults were being reinserted after deletion during migration/upsert flows.
- Alternatives considered: hard-delete defaults from canonical seed; prevent deleting defaults.
- Consequence: User intent for deleting defaults persists across reloads/devices while preserving canonical seed for reset flows.
- Status: implemented

### D-007

- Date: 2026-02-15
- Decision: Cloud profile sync uses client-timestamp conflict ordering and retry-on-failure lifecycle flushing.
- Context: Eventual-consistency windows and dropped writes caused occasional stale rehydration.
- Alternatives considered: keep best-effort fire-and-forget writes; synchronous/blocking startup hydration.
- Consequence: Better durability and lower chance of stale-state resurrection, with slightly more sync complexity.
- Status: implemented

### D-008

- Date: 2026-02-15
- Decision: Add auth gate for profile endpoints before broader (non-trusted) sharing.
- Context: Current endpoints are unauthenticated and acceptable only for single-user/trusted use.
- Alternatives considered: keep endpoints open; simple static secret only.
- Consequence: Requires selecting auth model and rollout plan before expansion.
- Status: accepted (deferred)

### D-009

- Date: 2026-02-15
- Decision: Add user-controlled Battery Saver mode that reduces timer-screen effects and switches timer ticks to coarse cadence.
- Context: Long workout sessions on iPhone showed elevated heat/battery use versus expected timer-app baseline.
- Alternatives considered: keep full effects always on; remove effects globally with no toggle.
- Consequence: Lower sustained rendering/animation load on mobile while preserving timing accuracy via monotonic elapsed-time derivation.
- Status: superseded

### D-010

- Date: 2026-03-15
- Decision: Freeze Tier 1 contracts to the implemented runtime: `eliteTimer_settings` stores only `sessionMinutes` and `intervalSeconds`, and the dormant `eliteTimer_audioPrefs` storage path is retired.
- Context: Tests and docs had drifted away from the current application behavior, including references to removed `batterySaverMode`, `useBackgroundMusicState`, and background-music runtime paths.
- Alternatives considered: restore the removed settings/audio features to match stale docs; keep the dormant audio-preference key despite having no runtime consumer; defer contract alignment until broader architecture work.
- Consequence: Runtime, tests, and docs now describe the same active storage contract, and future work no longer has a dead audio-preference surface to misread as supported behavior.
- Status: implemented

### D-011

- Date: 2026-03-15
- Decision: Clarify Tier 2 boundaries by centralizing saved-session restore policy in `sessionResumePolicy`, fixed timer-phase timing in `timerPhase`, and profile-driven screen refresh in App-level `profileRevision`.
- Context: Session persistence, timer-phase semantics, and storage-backed screen refresh behavior were split across `TimerScreen`, `useTimer`, `App`, and profile CRUD screens in ways that made bugs and stale-data behavior harder to reason about.
- Alternatives considered: leave the boundaries implicit until a broader Tier 3 refactor; move directly to a larger architectural split of `workoutStorage` and timer/session modules.
- Consequence: The current subsystem boundaries are explicit in code without yet restructuring the larger modules. Profile-backed screens now refresh from a shared app-level revision signal, and timer restore/phase rules are defined by dedicated helpers.
- Status: implemented

### D-012

- Date: 2026-03-15
- Decision: Treat Tier 3 as the next pending wave that starts from the already-implemented cloud-sync durability baseline.
- Context: D-007 and the current runtime already implement client-timestamp ordering, retry-on-failure writes, lifecycle flush handlers, and local-vs-remote boot winner selection, but the handoff wording still left Tier 3 sync scope easy to misread as entirely unstarted.
- Alternatives considered: describe all sync durability work as still pending Tier 3 scope; reopen Tier 2 to absorb the remaining sync conflict-model work; reorder Tier 3 around storage decomposition first.
- Consequence: Tier sequencing now matches the implemented runtime. The remaining Tier 3 work is limited to unresolved conflict-model remediation, `workoutStorage.js` hub decomposition, and deeper session-state consolidation.
- Status: implemented

### D-013

- Date: 2026-03-15
- Decision: Resolve cloud profile conflicts per section using `workoutsUpdatedAt`, `warmupsUpdatedAt`, and `cardiosUpdatedAt`.
- Context: Whole-profile timestamp gating could drop a valid older patch for one section when another section had a newer overall profile timestamp.
- Alternatives considered: keep whole-profile timestamp ordering only; always accept partial patches regardless of staleness; move immediately to a larger sync protocol rewrite.
- Consequence: Unrelated section updates no longer clobber each other during cloud merges. Tier 3 sync work can now build on section-level conflict ordering instead of the previous whole-profile gate.
- Status: implemented

### D-014

- Date: 2026-03-15
- Decision: Diagnose and recover the iPhone audio interruption bug through persistent runtime diagnostics and stalled-playback graph rebuilds, not `AudioContext.state` alone.
- Context: Physical-device logs showed bell and speech playback could emit `*_start` while hidden and then never emit the matching `*_end`, even though `AudioContext.state` still reported `running` and keepalive pulses continued.
- Alternatives considered: treat `running` as sufficient health evidence; rely only on unlock-on-interaction plus keepalive; defer investigation until a native iOS audio layer exists.
- Consequence: The runtime now records device-side audio events in an in-app diagnostics drawer and rebuilds the Web Audio graph when a playback start outlives its expected completion window. This adds observability and a concrete recovery path while keeping the defect open until real-device validation confirms recovery.
- Status: implemented

### D-015

- Date: 2026-03-16
- Decision: Retire the in-app diagnostics drawer and replace it with a subtle icon-only manual sound-recovery control while keeping stalled-playback recovery in `audioManager`.
- Context: The diagnostics surface served its purpose during physical-device investigation, but the product now needs a user-facing fallback more than continued in-app log capture. The recurring failure mode is "timer keeps running while sound becomes untrustworthy," so the highest-value control is a direct-gesture recovery path that can re-prime future cues mid-session.
- Alternatives considered: keep the diagnostics drawer indefinitely; add a text-heavy recovery button; remove diagnostics without offering a user fallback.
- Consequence: The app no longer persists or displays audio diagnostics in-product. Instead, active and paused sessions expose a subtle icon-only sound-recovery control that can rebuild or recreate the audio graph under direct user interaction and play a confirmation chirp without resetting timer progress.
- Status: implemented

### D-016

- Date: 2026-03-20
- Decision: Move iPhone interval cue scheduling out of the JS timer loop and into a native `EliteTimerRuntime` scheduler, while keeping React as the UI/state presentation layer.
- Context: Physical-device testing of the first hybrid slice showed that native bell playback alone was not enough. The webview timer loop could still be suspended in background, causing interval bells to queue up and only fire when the app returned to foreground.
- Alternatives considered: keep the JS timer loop as cue authority and rely on native playback only; treat background-audio keepalive as sufficient without session projection/readback; defer the issue until a larger full-native rewrite.
- Consequence: The Capacitor iPhone shell now owns interval cue scheduling, background-audio keepalive, mirrored active-session persistence, and projected-session readback through `ios/App/App/EliteTimerRuntimePlugin.swift`. The React hook still renders timer state, but it now reconciles against native mirrored session state and no longer emits interval bells from JS when native cue ownership is present.
- Status: implemented

### D-017

- Date: 2026-03-20
- Decision: Defer structural cleanup until after build/deploy trust, focused iPhone runtime validation, timer UX polish, and sync durability hardening are complete, and then execute cleanup only as bounded seam extraction.
- Context: Earlier in the day, the main product risks were not structural purity but stale device installs, uncertain native-runtime behavior, timer-screen clarity, and persistence confidence. A broad refactor before closing those would have mixed product risk with architecture risk and made debugging slower.
- Alternatives considered: start module decomposition immediately once the native timer basically worked; roll storage, timer, and native cleanup together into one large post-migration pass; leave cleanup entirely undocumented and handle it ad hoc later.
- Consequence: `workoutStorage.js`, `useTimer`, and native-shell polish remain legitimate future cleanup targets, but they now have an explicit entry bar, ordering, and stop conditions. The next structural pass should follow a bounded plan instead of reopening already-closed trust and validation work.
- Status: accepted

### D-018

- Date: 2026-03-21
- Decision: In the Capacitor iPhone shell, speech output uses native scheduling plus playback of the bundled announcement assets; Web Audio speech remains the web/PWA path, not the primary native path.
- Context: The primary user wants speech to sound exactly like the historical cue voice, continue while locked or in other apps, and coexist smoothly with the bell. WKWebView/browser fallback proved insufficient for that requirement.
- Alternatives considered: keep browser/Web Audio fallback as the main iPhone speech path; use native synthesized text-to-speech; defer speech entirely until a larger rewrite.
- Consequence: iPhone-native speech now shares the native runtime model with the bell while preserving the existing cue voice. Ongoing physical-device validation remains necessary to confirm long-run coexistence and lock/app-switch reliability.
- Status: implemented

### D-019

- Date: 2026-03-21
- Decision: Treat the current deployment as single-user/trusted use, and keep endpoint auth as a broader-sharing gate rather than the immediate sprint priority.
- Context: The primary user clarified the app is for personal use and prioritized reliable speech output plus durable editable workout memory over near-term multi-user hardening.
- Alternatives considered: prioritize auth before runtime polish; broaden sharing before selecting an auth model.
- Consequence: runtime and storage work can stay focused on personal-use reliability for now, but D-008 remains open before any wider distribution.
- Status: accepted

### D-020

- Date: 2026-03-22
- Decision: Persist an optional workout-structure signature in saved sessions and require it for checklist restore when present.
- Context: Resume timing could remain correct while checklist progress silently mapped onto the wrong rows after reordering exercises, changing set counts, or editing attached warm-ups/cardios on a workout with the same `workoutId`.
- Alternatives considered: keep workout-id-only restore semantics; move immediately to richer per-exercise identity-based progress storage; always discard checklist progress on every resume.
- Consequence: resume remains convenient and backward-compatible, but edited workout structures now reset checklist progress instead of risking misleading restore behavior. Timing resume still depends on timer configuration compatibility, not on structure identity.
- Status: implemented

### D-021

- Date: 2026-03-22
- Decision: Split `eliteTimer_settings` into separate `workoutDefaults` and `timerOnlyDefaults` presets, and remove the Home-screen build stamp in favor of the existing boot log for build verification.
- Context: The same timing preset was being reused for both workout launches and timer-only launches, which made timer-only customization overwrite workout defaults. The Home build stamp also added visual noise to the main screen after the build-trust work was already covered by the `[build]` console/Xcode log.
- Alternatives considered: keep one shared preset and tell users to switch values manually; add a larger standalone settings screen; keep the build stamp visible indefinitely.
- Consequence: Workout launches and timer-only launches now persist independently without changing the existing timer infrastructure. Build verification remains available through the boot log and runbooks, while the Home screen stays cleaner.
- Status: implemented

### D-022

- Date: 2026-03-22
- Decision: Treat timer-only as its own neutral session mode in the Timer header and prefer simulator-first visual QA for mobile-facing UI work.
- Context: After timer-only became a first-class Home action, reusing `WARM UP` / `WORKOUT` language for that mode felt misleading. At the same time, the primary user confirmed that simulator review is the most trustworthy day-to-day source for mobile UI polish compared with browser-only checks.
- Alternatives considered: keep the workout-phase labels even for timer-only; remove the timer header label entirely; continue treating browser review as the default UI validation loop.
- Consequence: Timer-only sessions now present as `TIMER ONLY` and suppress speech milestones, while repo guidance now explicitly prefers simulator-first review for mobile UI changes. Physical-iPhone validation remains necessary for lock-screen, background audio, bells, speech, and haptics.
- Status: implemented

### D-023

- Date: 2026-04-21
- Decision: Synthesize the voice pack locally with Kokoro (`camilo-kokoro`, `bright`/`af_bella` @ speed 0.9) and ship rendered WAVs in both the web and iOS bundles.
- Context: The previous pipeline depended on edge-tts and ad-hoc MP3 conversions. The primary user owns a local Kokoro playground at `/Users/camiloperezsetright/Projects/kokoro-playground` and wanted a reproducible pack with pinned voice/speed and a "Cameelo" pronunciation rule.
- Alternatives considered: keep edge-tts; switch to on-device native TTS; ship an MP3 pack to save bytes.
- Consequence: Voice rendering no longer requires network access or ffmpeg; WAV at 24 kHz mono avoids format conversion but costs disk size. Profile/speed are pinned in `audio-manifest/render.py` so the manifest stays transcript-only.
- Status: implemented

### D-024

- Date: 2026-04-21
- Decision: Generate the coaching cue schedule in JS at session start and consume it verbatim in Swift, rather than re-deriving it natively.
- Context: Coaching cues need to be frequent (~120s), short, presence-focused, and non-repetitive within a session. The schedule must stay identical across the JS UI (for visibility/debug) and the native scheduler that actually fires cues.
- Alternatives considered: generate independently on both sides from a shared seed; drive everything from Swift and expose via read-back; hardcode a fixed pattern.
- Consequence: There is one authoritative source for each session's schedule. `sessionSnapshot` carries `coachingSchedule: [{key, at}, ...]`; the native plugin merges structural + coaching into `combinedSpeechMilestones`. Any scheduling policy change lives in `timerPhase.buildCoachingSchedule` only.
- Status: implemented

### D-025

- Date: 2026-04-21
- Decision: Layer the mute toggle at both the JS bridge and the native plugin, and keep the timer/schedule fully running while muted.
- Context: Users need to silence audio mid-session without losing interval counting, visual progress, or resume correctness. A single-layer mute would either break native playback paths or leave the web fallback unmuted.
- Alternatives considered: pause playback engines entirely (loses keepalive); mute only at the UI level (native still plays); tear down the schedule when muted.
- Consequence: `setRuntimeMuted` short-circuits JS `playIntervalCue`/`playSpeechCue` and calls the plugin's `setMuted`, which gates `playCueBuffer`/`playSpeechBuffer`. Schedules still advance and "played" bookkeeping still runs, so unmuting does not cause catch-up bursts.
- Status: implemented

### D-026

- Date: 2026-04-21
- Decision: Trigger the completion overlay only when stop/reset happens after elapsed has reached the configured session duration.
- Context: The prior overlay fired on every reset, including cancel-before-complete, which made "completion" semantically meaningless.
- Alternatives considered: fire on any reset; fire only on auto-stop at duration; add a separate "completed vs cancelled" status field.
- Consequence: `useTimer.reset` now captures elapsed-vs-duration before clearing and sets `completedElapsedSeconds` accordingly. Overtime completions (stop pressed after the configured duration) continue to surface the overlay; early cancels do not.
- Status: implemented

### D-027

- Date: 2026-04-21
- Decision: Close the voice pack pipeline with `scripts/sync-voice-pack.mjs` (`npm run voice-pack:sync`) as the one command that verifies parity and updates both bundles.
- Context: Manual copy from `audio-manifest/rendered/` to `public/audio/` and `ios/App/App/public/audio/` was easy to forget and hard to review. Slug drift between the manifest, catalog, Swift plugin, and rendered files was invisible until runtime.
- Alternatives considered: rely on a Makefile; add a CI-only check without local copy; let the bundler pull from `audio-manifest/rendered/` directly.
- Consequence: One command gates the pipeline. Structural slugs are asserted literally in both `speechCueCatalog.js` and `EliteTimerRuntimePlugin.swift`; coaching slugs (`warmup_coach_NN`/`workout_coach_NN`) are generated in loops so only manifest+rendered parity is asserted for them. Exit code is nonzero on any mismatch so this can gate CI.
- Status: implemented
