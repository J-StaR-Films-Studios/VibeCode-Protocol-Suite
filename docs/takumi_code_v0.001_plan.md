# Takumi Code v0.001 — Full-Feature Launch Plan (Kilo YAML Aligned)

## 1) Scope Lock
This plan defines the **day-one required** orchestration behavior for Takumi Code.
No feature in this document may be removed for `v0.001`; any de-scope requires a version bump.

## 2) Source of Truth for Agent Split
Takumi will use the agent split and behavior contracts from the Kilo-style YAML modes in `assets/Takomi-Agents/`:

- `vibe-orchestrator.yaml`
- `vibe-architect.yaml`
- `vibe-code.yaml`
- `vibe-debug.yaml`
- `vibe-review.yaml`
- `vibe-ask.yaml`
- `vibe-visionary.yaml`
- supporting wiring in `custom_modes.yaml` and `kilo-code-settings.json`

This replaces the generic split previously proposed (e.g., planner/docs-writer as primary agents).

## 3) Day-One Orchestration Model (VibeCode Protocol First)

### Primary lifecycle workflows (must exist from day one)
1. **Genesis** (`/vibe-genesis`) — requirements, PRD, issues, implementation plan.
2. **Design** (`/vibe-design`) — design system, mockups, visual direction.
3. **Build** (`/vibe-build`) — scaffold + core implementation.
4. **Continue Build** (`/vibe-continueBuild`) — context recovery and incremental delivery.
5. **Finalize** (`/vibe-finalize`) — verification, docs sync, handoff.

### Mode agents used by orchestrator during lifecycle
- **Orchestration:** `vibe-orchestrator`
- **Architecture/Planning:** `vibe-architect`
- **Implementation:** `vibe-code`
- **Debug/Fix:** `vibe-debug`
- **Quality Review:** `vibe-review`
- **Analysis/Research:** `vibe-ask`
- **Product strategy/ideation support:** `vibe-visionary`

## 4) Required Runtime Behavior

1. User starts in orchestrator context.
2. Orchestrator clarifies objectives and constraints.
3. Orchestrator builds a full task graph mapped to Genesis/Design/Build flow.
4. User approves the plan.
5. Orchestrator dispatches child agents by mode YAML contract.
6. Each child returns summary, artifacts, changed files, and risks.
7. Control auto-returns to orchestrator for validation.
8. Orchestrator triggers fix loops (`vibe-code`/`vibe-debug`) and quality loops (`vibe-review`) before progressing.
9. User may intervene during active child execution (inject, pause, resume, cancel, replace).
10. Nested orchestration is supported (orchestrator can spawn sub-orchestrator branches).

## 5) Execution Mapping

| Lifecycle Stage | Default Mode | Command Family | Typical Outputs |
|---|---|---|---|
| Genesis | `vibe-architect` (coordinated by `vibe-orchestrator`) | `/vibe-genesis` | PRD, issue plan, constraints |
| Design | `vibe-architect` | `/vibe-design` | design system docs, mockups |
| Build | `vibe-code` | `/vibe-build` | scaffold + implemented features |
| Continue | `vibe-code` | `/vibe-continueBuild` | resumed context + next increments |
| Finalize | `vibe-review` + `vibe-architect` | `/vibe-finalize` | verification report, handoff package |

## 6) Product + Delivery Requirements for v0.001

- **Tree orchestration UI:** parent/child runs, status, timeline.
- **Background child execution:** continue working in orchestrator while children run.
- **Live intervention controls:** inject guidance and reroute active tasks.
- **Cloud + local runtime:** SaaS sandbox execution and desktop/local execution modes.
- **Payment rails:** Paystack for fiat subscriptions; Bags API for onchain fee-sharing flows.
- **Auditability:** event log for all runs, interventions, and payment entitlement changes.

## 7) Non-Negotiable Acceptance Gate
v0.001 can launch only if:

- The agent split is YAML-aligned with `assets/Takomi-Agents/`.
- Genesis/Design/Build lifecycle and follow-up workflows are fully wired.
- Orchestrator review loop and intervention controls are fully functional.
- Cloud/local execution modes are both operational.
- Paystack + Bags payment success path and entitlement checks pass end-to-end.
