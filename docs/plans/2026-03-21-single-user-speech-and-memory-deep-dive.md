# Single-User Speech And Memory Deep Dive

Last updated: March 21, 2026

## Status Note

The speech-launch analysis in this document is now historical.

- As of March 21, 2026, native iPhone speech playback/scheduling has been implemented.
- Treat `docs/current-state-handoff.md`, `docs/plans/2026-03-21-sprint-closeout.md`, and `docs/decision-log.md` as the current source of truth for speech/runtime ownership.
- The active-session memory analysis and structure-signature recommendation below remain relevant.

## Scope

This note narrows the open-decision backlog to the two areas that matter most for the current product owner:

1. how to launch speech output without breaking the baseline timer/runtime requirements
2. how saved workout/exercise memory works today, especially when editing workouts moving forward

Assumption:

- the app is for one trusted user only
- broader multi-user hardening is not the current priority

## Baseline To Protect

Any change in this area should preserve:

- native interval cue scheduling remains authoritative on iPhone
- bells/countdown reliability stays more important than speech
- manual sound recovery never resets timer progress
- active-session resume remains safe even if it becomes more conservative
- workout edits still persist locally first and sync best-effort second

## 1. Speech Output

### Current State

What exists now:

- milestone speech keys are defined and bundled as `.mp3` assets in `public/audio/`
- the web/PWA audio runtime preloads and plays those voice files
- `TimerScreen` triggers milestone speech from elapsed-time thresholds
- the native iPhone plugin exposes `playSpeechCue`, but currently reports speech as disabled

Effective behavior today:

- web/PWA builds can play speech announcements when audio is available
- native iPhone-shell builds do not currently produce speech output because the bridge treats the native plugin as the handler, even though the native plugin says speech is disabled

Practical implication:

- speech is already a real feature in browser mode
- speech is effectively off in the current iPhone-native mode

### Safe Launch Options

#### Option A: Keep Speech Web-Only For Now

Behavior:

- keep current browser speech output
- keep native shell bells only
- defer all iPhone speech work

Pros:

- lowest risk to the current bell-reliability baseline
- no new bridge ambiguity
- no native audio behavior change

Cons:

- speech remains unavailable in the version that matters most for lock/app-switch reliability

Risk level:

- low

#### Option B: Add Native-Shell Foreground Fallback To Browser Speech

Behavior:

- when the native plugin reports `speechEnabled = false`, the bridge falls back to browser speech playback instead of stopping there
- speech remains best-effort only
- bells stay native-owned
- speech is allowed only while the app is foreground-visible

Pros:

- smallest path to hearing speech on iPhone without moving interval authority back into JS
- preserves the current native bell scheduler
- leverages the already-shipped voice assets

Cons:

- speech would still not be trustworthy in background/lock state
- requires careful bridge behavior so native-handled bells and browser-handled speech do not blur together conceptually

Risk level:

- medium-low

#### Option C: Implement Full Native Speech Output

Behavior:

- native plugin owns speech playback too, likely through bundled audio assets or speech synthesis

Pros:

- cleanest long-term ownership model for iPhone
- potential background consistency if implemented carefully

Cons:

- highest effort
- easiest way to accidentally destabilize the bell/audio baseline
- requires fresh device validation

Risk level:

- medium-high

### Recommended Decision

Recommended default for this app as a single-user tool:

- choose Option B first
- keep speech explicitly "best-effort, foreground-only"
- keep bells/countdown/native scheduling untouched
- do not promise speech while locked or backgrounded

Recommended rollout shape:

1. Bridge fallback only when native reports `speechEnabled = false`
2. Speech guarded by app visibility
3. Manual sound-recovery behavior preserved exactly as-is
4. Validate on:
   - web/PWA
   - native shell in foreground
   - native shell after app return, confirming UI catch-up still works and speech does not replay incorrectly

Recommended product wording:

- treat speech as an assistive layer
- treat bells as the non-negotiable workout-loop cue

### Optional Setting Decision

For a single-user app, a local-only toggle is reasonable if desired:

- `speechAnnouncementsEnabled`
- default `off` for the first native-shell rollout, then flip to `on` later if the experience is clearly stable

This is not required, but it gives a safe escape hatch without inventing a broader settings system.

## 2. Current Memory Model For Saved Exercises

There are two separate memory systems in the app today:

1. library memory
2. active-session memory

They solve different problems and should stay conceptually separate.

### Library Memory

This is the persistent profile data for:

- workouts
- warm-ups
- cardios

How it works:

- editor screens sanitize exercise data before save
- records are stored in local storage first
- cloud profile sync is queued afterward as best-effort write-through
- canonical defaults are editable after first load
- deleting a default writes a tombstone so it does not come back automatically

What is remembered per exercise record:

- stable `id`
- `name`
- `sets`
- `reps`
- `rest`
- `rpe`
- `note`

What is remembered per workout:

- stable `id`
- `name`
- `type`
- ordered `exercises`
- attached `warmupIds`
- attached `cardioIds`
- `pinned`
- `createdAt`

Important property:

- this is durable content memory, not in-session progress memory

### Active-Session Memory

This is the resume snapshot for a currently running or paused session.

It is stored in:

- local storage (`eliteTimer_activeSession`)
- native mirrored session state on iPhone

What it remembers:

- timing state
- interval state
- workout identity (`workoutId`, `workoutName`)
- checklist progress (`exerciseProgress`)

What it does **not** remember:

- a full copy of every workout exercise record
- per-exercise semantic identity beyond array position inside the current workout layout

### How Checklist Restore Works Today

Current policy:

- resume requires matching timer configuration (`sessionMinutes`, `intervalSeconds`)
- checklist restore is allowed only when the saved `workoutId` matches the current workout `id`
- when it restores, saved progress is normalized against the current exercise array by position and set count

This means:

- same workout id + same exercise order usually restores well
- same workout id + reordered exercises can restore progress onto the wrong row
- same workout id + added/removed exercises can shift progress positions
- same workout id + changed set counts can partially remap because restore is by index and set length, not by exercise id
- changing warm-up or cardio attachments can also shift the combined exercise ordering seen by the timer

This is safe in the sense that it does not crash, but it is not semantically rich memory.

## 3. Editing Implications Moving Forward

### What Is Safe Today

- editing workouts/warm-ups/cardios for future sessions
- renaming workouts
- adjusting reps/rest/notes
- adding and deleting exercises in the library
- attaching/detaching warm-ups and cardios

### What Is Risky Today

- editing a workout while an active session for that same workout still exists and expecting checklist restore to remain exact
- reordering exercises in a workout and expecting old saved checkmarks to follow the correct exercise semantically
- changing warm-up/cardio attachments and expecting old progress to map perfectly after resume

### Recommended Near-Term Decision

Recommended next memory decision:

- keep the current durable library model
- make active-session restore more conservative

Best next step:

- persist a workout-structure signature in the saved session
- on resume, if the same workout id has a different structure signature, restore timing but reset checklist progress with a clear message

Good inputs for a structure signature:

- ordered exercise ids
- ordered warmup ids
- ordered cardio ids
- set counts per exercise

This protects correctness without needing a larger redesign.

### Recommended Longer-Term Decision

If preserving progress across edits becomes important, move from position-based session progress to identity-based session progress.

That would mean storing something closer to:

- `exerciseId`
- section/source information
- `setsCompleted`

This is a bigger change, but it would let progress survive reordering much more predictably.

## 4. Recommended Backlog Order

For this single-user app, the highest-value order is:

1. speech output on native shell via safe browser fallback while foregrounded
2. workout-structure signature guard for resume correctness
3. only after that, decide whether full native speech is worth it
4. only after that, decide whether exercise-id-based resume memory is worth the added complexity

## 5. Decisions I Would Recommend Making Now

If we want defaults today, my recommendations are:

- Speech output:
  Launch foreground-only browser fallback on native shell before attempting native speech.
- Speech promise:
  Bells are authoritative; speech is best-effort assistive output.
- Saved exercise memory:
  Keep library persistence as-is.
- Resume correctness:
  Add a structure-signature guard before adding richer memory.
- Auth:
  Keep deferred, because the app is single-user and trusted for now.

## 6. Practical Summary

The app already has most of the speech-output ingredients, but the current native bridge suppresses them on iPhone. The safest launch path is not "make speech native immediately"; it is "fall back to existing browser speech only when visible, while leaving native bell authority alone."

The app also already remembers exercises well at the library level, but active-session memory is intentionally shallow. It remembers enough to resume a session safely, not enough to perfectly follow workout edits. If resume correctness matters during editing, the next improvement should be a structure-signature guard, not a full memory rewrite.
