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
- Status: accepted

### D-004

- Date: 2026-02-15
- Decision: Netlify config is portable and in-repo.
- Context: Machine-specific absolute path created deploy fragility.
- Alternatives considered: environment-local config only.
- Consequence: Reproducible deploy behavior; requires avoiding local state leakage in commits.
- Status: implemented
