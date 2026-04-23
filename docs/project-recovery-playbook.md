# Project Recovery Playbook

Last updated: March 20, 2026

Use this when a project has grown quickly (feature stacking, hotfixes, drift) and needs a safe path back to stability without losing momentum.

## Goal

- Re-establish trust in the codebase.
- Improve maintainability without accidental behavior changes.
- Fix known bugs intentionally with regression safety.
- Leave clear documentation so handoff is easy.

## Phase 0: Foundation + Platform Baseline

Objective: make change management safe before touching behavior.

Checklist:
- Ensure project is in git (with remote).
- Confirm deploy target/linkage (Netlify/Vercel/etc.).
- Verify CI exists (or add minimal lint/test/build pipeline).
- Confirm local run/build commands are documented and reproducible.
- Remove machine-specific config paths.

Exit gate:
- Clean commit history starts here.
- CI green on current `main`.
- Deploy pipeline deterministic.

## Phase 1: Discovery Scan (Read-Only)

Objective: understand system architecture, data flow, and risk before edits.

Checklist:
- Map runtime topology (entrypoints, screens/routes, state owners).
- Identify persistence model(s) and schema/version rules.
- Inventory docs and mark stale/missing areas.
- Build risk list with file pointers and likely failure modes.
- Capture assumptions/unknowns that block confidence.

Deliverables:
- Architecture map
- Invariants (must-not-break behaviors)
- Risk register
- Decision log (initial)
- Test strategy baseline

Exit gate:
- Team agrees on key unknowns and default decisions.
- Refactor scope explicitly excludes behavior changes.

## Phase 2: Structure-Only Refactor

Objective: improve clarity/modularity without changing behavior.

Rules:
- One concern per PR/commit.
- Keep changes small and reversible.
- No bug fixes mixed into refactor commits.
- Preserve public interfaces and runtime behavior.

Typical refactor targets:
- Naming clarity
- Extract pure helpers
- Isolate side effects
- Remove duplication
- Tighten state ownership boundaries

Exit gate:
- All tests unchanged and green.
- Invariants still hold.
- Docs updated for structural movement only.

## Phase 3: Intentional Bug-Fix Pass

Objective: fix confirmed bugs with explicit intent and regression coverage.

Rules:
- Reproduce first.
- Add/adjust failing test where feasible.
- Fix smallest safe surface.
- Verify no adjacent behavior regressions.

For each bug:
- Symptom
- Repro steps
- Root cause
- Fix summary
- Validation evidence

Exit gate:
- Bug backlog triaged (fixed/deferred).
- Regression tests added for fixed bugs.
- Deploy validated in production-like environment.

## Phase 4: Reliability + Hardening

Objective: address durability/security/operational risks discovered during bug fixes.

Examples:
- Conflict handling and retries for sync systems
- Lifecycle flush behavior (online/background/pagehide)
- Auth/authorization gates for writable endpoints
- Observability (last sync, pending writes, error counters)
- Device-side diagnostics for browser/runtime-only failures or hybrid/native runtime failures (for example Web Audio interruption traces or native iPhone interval-runtime drift)

Exit gate:
- High-impact risks either mitigated or explicitly deferred with owner + trigger.
- Hardening roadmap is documented (not tribal knowledge).

## Phase 5: Handoff + Retro

Objective: make future contributors fast and safe.

Checklist:
- Update README quickstart + runbook.
- Refresh architecture/invariants/risk/decision/test docs.
- Record “what changed / why / what’s next”.
- Write a short retro:
  - what worked
  - what slowed us down
  - what to do earlier next time

Exit gate:
- A new engineer can ramp in <1 hour with docs + scripts only.

## PR / Commit Strategy Template

- `chore/foundation`: git, CI, deploy portability.
- `docs/discovery`: architecture + risks + decisions.
- `refactor/*`: structure-only, one concern each.
- `fix/*`: bug-specific + regression test.
- `hardening/*`: reliability/security hardening.
- `docs/handoff`: final docs + retro.

## Minimal Quality Gates (Always On)

- `npm run lint`
- `npm test`
- `npm run build`
- one end-to-end smoke test
- manual smoke for browser/device-specific behavior
- capture device-side diagnostics when the failing behavior only appears on real hardware

## Practical Operating Principles

- Don’t mix refactor and bug fixes in one change.
- Prefer explicit decisions over implicit behavior.
- Preserve a bug backlog instead of “while we’re here” edits.
- Treat docs as part of the deliverable, not cleanup.
- If behavior might change, pause and get approval first.
