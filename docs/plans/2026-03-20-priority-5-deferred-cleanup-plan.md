# Priority 5 Deferred Cleanup Plan

Last updated: March 20, 2026

## Purpose

Priority 5 is intentionally a deferred structural-cleanup pass, not the next urgent implementation wave.

The app has now completed:
- Priority 1: build/deploy trust
- Priority 2: focused iPhone runtime validation
- Priority 3: timer/audio UX polish
- Priority 4: sync/data durability audit plus targeted regression coverage

That means the next structural work should only happen if it stays bounded, preserves the newly stabilized contracts, and does not reopen the trust problems that were just closed.

## Entry Criteria

Only start Priority 5 when all of the following are true:
- no higher-priority timer/runtime bug is active
- no active data-loss or sync regression is open
- the current build/deploy trust path remains intact
- the cleanup has a bounded seam, clear owner, and explicit stop condition

If a new user-facing bug appears first, it outranks Priority 5.

## Goals

- Reduce coupling in the main hotspots without changing product behavior.
- Preserve the current timer/runtime, persistence, and sync contracts while making future work safer.
- Extract bounded modules, not a new architecture.

## Non-Goals

- No broad visual redesign.
- No sync protocol rewrite.
- No new auth or distribution initiative inside this pass.
- No "full native app" rewrite.
- No public API churn unless a specific seam truly requires it.

## Contract-Bearing Boundaries To Preserve

Do not casually move or redefine these while cleaning up structure:

- `src/platform/intervalRuntimeBridge.js`
  Native vs web cue ownership stays explicit and centralized.
- `ios/App/App/EliteTimerRuntimePlugin.swift`
  Native cue scheduling, mirrored-session projection, and background-audio behavior remain one coherent contract.
- `src/utils/sessionSnapshot.js`
  Owns saved-session payload shaping and metadata sanitization.
- `src/utils/sessionResumePolicy.js`
  Owns resume compatibility and checklist restore/reset policy.
- `src/utils/timerPhase.js`
  Owns the fixed warm-up timing boundary.
- `src/utils/cloudProfileSync.js`
  Owns section-level sync staging and hydration semantics.

## Workstreams

### 1. `workoutStorage.js` Hub Decomposition

This is still the highest-coupling client-data hotspot.

Target outcomes:
- isolate canonical default seeds from mutation logic
- isolate shared normalization/migration helpers
- isolate entity-specific CRUD paths where that reduces cross-entity coupling
- keep existing external behavior and tests intact

Likely extraction seams:
- canonical default seed data
- deleted-default tombstone helpers
- warmup/cardio reference cleanup helpers
- entity-specific loaders/savers if they can move cleanly

Guardrails:
- preserve existing exports unless there is a strong reason not to
- keep `workoutReadModels` and `workoutExerciseSections` as the preferred screen-facing read path
- do not mix structural cleanup with product-behavior changes

### 2. Session-State Consolidation

The timer flow is now much clearer than before, but `useTimer.js` still carries a lot of orchestration weight.

Target outcomes:
- reduce branching pressure in `useTimer`
- extract pure transition/derivation helpers where that improves clarity
- preserve current runtime behavior across web and native-shell modes

Likely extraction seams:
- countdown/start transition helpers
- pause/resume/reset transition shaping
- native sync reconciliation helpers
- speech milestone dispatch decisions

Guardrails:
- do not move native cue authority back into JS
- do not blur the ownership split between `useTimer`, `sessionSnapshot`, `sessionResumePolicy`, and `intervalRuntimeBridge`
- every extraction should leave behavior easier to test, not just move code around

### 3. Native Runtime Polish Backlog

This is separate from timer behavior work and should stay clearly scoped.

Current candidates:
- adopt the modern `UIScene` lifecycle before it becomes a hard requirement
- investigate the `unsafeForcedSync called from Swift Concurrent context` warning
- clean up obviously debug-only native runtime oddities once they are confirmed non-contractual

Guardrails:
- no speculative native rewrites
- no audio-behavior changes without real-device validation

## Recommended Order

1. `workoutStorage.js` bounded extraction
2. `useTimer` session-state simplification
3. native runtime polish items

Why this order:
- `workoutStorage.js` is the largest day-to-day coupling hotspot
- timer/runtime behavior is now stable enough that session-state cleanup should be careful, not first
- native runtime polish should happen after behavior-critical cleanup, unless one of the warnings turns into a real blocker

## Validation Expectations

At minimum:
- targeted tests for the seam being touched
- `npm test`
- `npm run lint`
- `npm run build`

If native-shell behavior is touched:
- `npm run ios:sim-smoke`
- physical-iPhone spot check for the affected runtime path

## Stop Conditions

Stop Priority 5 and reassess if:
- behavior changes become mixed with refactor intent
- a cleanup starts changing product semantics
- timer/audio/background behavior becomes harder to reason about
- the diff grows beyond one bounded seam without clear payoff

## Suggested Next-Session Reading

1. `docs/current-state-handoff.md`
2. `docs/architecture-map.md`
3. `docs/decision-log.md`
4. `docs/risk-register.md`
5. this file

## Practical Closeout Rule

Priority 5 should end with one of these outcomes:
- one bounded seam extracted and verified
- a documented reason it was not worth doing yet
- a smaller follow-up plan replacing the larger cleanup

If it starts turning into a rewrite, stop.
