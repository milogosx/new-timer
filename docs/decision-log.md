# Decision Log

Last updated: February 15, 2026

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
