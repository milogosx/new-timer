# Native Runtime Validation Checklist

Last updated: March 20, 2026

## Purpose

Validate the iPhone-native timer loop with enough structure that issues can be reproduced from evidence instead of memory.

## Preflight

Before any physical-iPhone runtime check:

1. Run `npm run ios:sync`.
2. Install from Xcode.
3. Confirm the `[build]` boot log in Xcode matches the expected git SHA and bundle id.
4. In Xcode logs, filter for `[runtime]` to isolate the app-level trace stream.

## Runtime Trace Contract

The app emits concise event logs in this format:

```text
[runtime] +1234ms timer.started {"intervalCount":1,"intervalSeconds":30}
```

Use these traces to correlate what you saw or heard with the timer lifecycle.

Highest-signal events:

- `timer.start_requested`
- `timer.countdown_started`
- `timer.countdown_tick`
- `timer.countdown_completed`
- `timer.started`
- `timer.interval_transition`
- `timer.paused`
- `timer.resumed`
- `timer.visibility_visible`
- `timer.native_sync_requested`
- `timer.native_sync_applied`
- `timer.reset`
- `timer.speech_milestone`
- `runtime.countdown_cue_scheduled`
- `runtime.speech_cue_requested`
- `runtime.native_session_read`

## Physical iPhone Checks

### 1. Countdown and first interval start

Steps:

- Start a workout or timer-only session.
- Watch the `3 -> 2 -> 1` sequence.
- Confirm the timer starts only after the countdown completes.

Expected UI:

- `3`, then `2`, then `1`
- timer display appears only after countdown completion
- main button changes from `STARTING...` to `PAUSE`

Expected traces:

- `timer.start_requested`
- `timer.countdown_started`
- `runtime.countdown_cue_scheduled`
- `timer.countdown_tick` with `2`
- `timer.countdown_tick` with `1`
- `timer.countdown_completed`
- `timer.started`

### 2. Foreground interval boundary

Steps:

- Stay in the app for at least one interval rollover.

Expected behavior:

- bell fires at the interval boundary
- interval count advances
- circle state changes correctly

Expected traces:

- `timer.interval_transition`

### 3. Pause and resume

Steps:

- Pause an active session.
- Wait 2 to 3 seconds.
- Resume.

Expected behavior:

- elapsed time stops while paused
- resume continues from the same interval state

Expected traces:

- `timer.paused`
- `timer.resumed`

### 4. Lock screen during active session

Steps:

- Start a session.
- Lock the phone for at least 2 intervals.
- Unlock and return to the app.

Expected behavior:

- bells continue while locked
- on return, UI catches up to the projected native session
- no replay burst of missed JS bells

Expected traces on return:

- `timer.visibility_visible`
- `timer.native_sync_requested`
- `runtime.native_session_read`
- `timer.native_sync_applied`

### 5. App switch and return

Steps:

- Start a session.
- Switch to another app for at least 2 intervals.
- Return to the timer.

Expected behavior:

- interval cues continue in the background
- foreground UI catches up cleanly

Expected traces on return:

- `timer.visibility_visible`
- `timer.native_sync_requested`
- `timer.native_sync_applied`

### 6. Reset and discard flows

Steps:

- Start a session, then reset it.
- Start another session, leave the screen, and discard the saved session if prompted.

Expected behavior:

- reset returns to a clean idle state
- discarded session does not reappear

Expected traces:

- `timer.reset`
- `timer.resume_discarded` or `timer.resume_discarded_mismatch`

## Issue Report Minimum

If a runtime issue appears, capture all 3:

- the `[build]` boot log lines
- what action was happening when it failed
- the `[runtime]` lines around the failure window

This should be enough to tell whether the problem was countdown timing, native sync catch-up, pause/resume state, or cue scheduling.
