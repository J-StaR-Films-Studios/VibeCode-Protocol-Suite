# Takomi Escalation Prompt: Pi TUI Multi-Subagent UI Still Broken

Generated: 2026-04-08

Use the Takomi escalation workflow for this handoff.

## Mission

You are taking over a partially repaired Pi TUI / Takomi runtime implementation.

Do not restart from scratch blindly. First diagnose the actual runtime/UI control flow.

The current codebase compiles, but the live Pi behavior is still wrong:

- `Alt+T` fires and shows notifications like `Takomi subagent view expanded`, but the visible subagent surface often does not materially change or mount fullscreen.
- Multiple subagents are being tracked in some form, but cycling between them is unreliable or reports `No additional Takomi subagents to cycle` even while the visible widget banner shows multiple agents, for example `Agents 3/5`.
- The compact card is somewhat improved, but the overall subagent UI control model is still inconsistent in live Pi.

## Current User-Observed Failures

The user has directly observed all of the following in Pi:

1. `Alt+T` triggers, but the UI does not actually expand/fullscreen correctly.
2. `Alt+N` / `Alt+P` or the equivalent cycling behavior can warn that there are no extra agents, even while the UI itself shows multiple tracked agents.
3. The right context panel is present now, but the core subagent interaction model is still not dependable enough for real use.

## Important Constraints

- Do not revert unrelated user changes.
- Do not use destructive git operations.
- Keep using `apply_patch` for edits.
- TypeScript must still pass with `pnpm exec tsc --noEmit`.
- This repo is missing the full Genesis doc set (`docs/project_requirements.md`, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/issues/`), so do not waste time assuming those exist.

## Likely Root-Cause Suspects

These are hypotheses, not proven facts. Verify them in code and in live behavior.

### Suspect 1: Two Separate `TakomiSubagentUi` Owners

There are two separate `TakomiSubagentUi` instances:

- `.pi/extensions/takomi-runtime/index.ts`
- `.pi/extensions/takomi-subagents/index.ts`

The runtime owns one:

- `const subagentUi = new TakomiSubagentUi("takomi-runtime-subagent");`

The subagent tool owns another:

- `const subagentUi = new TakomiSubagentUi("takomi-subagent");`

Meanwhile, the global view mode and focus commands act through the shared module-level registry in:

- `.pi/extensions/takomi-runtime/ui.ts`

That means command routing may be affecting multiple UI owners, while only one is actually visible/relevant in the current Pi interaction.

This is the strongest architectural suspect.

### Suspect 2: Global View-State + Multiple UI Instances

`subagentViewMode` is a module-global in `.pi/extensions/takomi-runtime/ui.ts`, while the actual run registries are instance-local.

That combination may be causing:

- view mode changes to propagate globally
- run focus changes to remain local to whichever instance receives them
- commands to succeed logically but not affect the currently displayed widget

### Suspect 3: Fullscreen Path Still Depends on the Wrong Active Context/Owner

Fullscreen mounting was partly repaired to use current `ctx`, but it still depends on the correct instance and active state:

- if the wrong `TakomiSubagentUi` instance receives the command, fullscreen can still appear “broken”
- if fullscreen is tied to a non-visible owner, the notification fires but the user sees no real overlay transition

### Suspect 4: Widget Rendering Is Focused on One Active Card, Not a Robust Multi-Agent Model

The current UI shows one focused run plus peer summaries. That is acceptable in principle, but only if:

- focus-switch commands always target the visible owner
- active run selection is deterministic
- the user can cycle reliably across all live subagents

That guarantee is currently missing.

## Relevant Files

- `.pi/extensions/takomi-runtime/ui.ts`
- `.pi/extensions/takomi-runtime/index.ts`
- `.pi/extensions/takomi-runtime/context-panel.ts`
- `.pi/extensions/takomi-subagents/index.ts`
- `docs/features/Pi_Takomi_Command_Center.md`

## Key Code Areas To Inspect First

### `.pi/extensions/takomi-runtime/ui.ts`

Look at:

- global view-mode state and instance registry
- `cycleTakomiSubagentFocus(...)`
- `TakomiSubagentUi`
- `refreshWithContext(...)`
- `showFullscreen(...)`
- `renderWidget(...)`

Notable details:

- lines around 29-72: global subagent view/focus functions
- lines around 397+: `TakomiSubagentUi`
- run registry was introduced via `private readonly runs = new Map<string, SubagentPanelState>()`
- the visible card still relies on a focused `overlayState` getter over active run state

### `.pi/extensions/takomi-runtime/index.ts`

Look at:

- subagent view/focus commands and shortcuts
- whether commands target the correct owner

Notable details:

- commands around lines 544-621
- `Alt+T`, `Alt+Shift+T`, `Alt+N`, `Alt+P`

### `.pi/extensions/takomi-subagents/index.ts`

Look at:

- the tool-owned `TakomiSubagentUi`
- per-conversation run key wiring

Notable details:

- the tool creates `new TakomiSubagentUi("takomi-subagent")`
- start/update/appendLog/complete/block now pass `conversationId`

## Current State Of The Attempt

What has already been repaired:

- footer is custom and active
- context panel exists and auto-opens
- subagent runs are now keyed by conversation/thread id inside `TakomiSubagentUi`
- compact view shows more than a single line
- TypeScript currently passes

What is still broken in live Pi:

- fullscreen/expand interaction does not reliably produce the visible mode transition the user expects
- focus cycling is still inconsistent despite multiple runs being tracked

## Directive

Do not do another surface-level patch.

Your job is to decide whether the correct fix is:

1. consolidate to a single `TakomiSubagentUi` owner for all Takomi subagent visualization
2. split runtime-vs-tool UI responsibilities cleanly and stop sharing global view/focus controls across them
3. replace the current focused-card model with a more explicit multi-card deck that removes ambiguity

You must choose one architecture and implement it cleanly.

## Acceptance Criteria

The task is complete only when all of the following are true in live Pi:

1. `Alt+T` visibly cycles compact -> expanded -> fullscreen -> compact.
2. `Alt+Shift+T` opens fullscreen for the currently visible/focused subagent.
3. If 3 subagents are active, cycling focus actually changes the visible focused subagent every time.
4. The UI must never report `No additional Takomi subagents to cycle` while the visible widget still claims multiple tracked agents.
5. `pnpm exec tsc --noEmit` passes after the fix.

## Suggested Plan

1. Inspect ownership of all `TakomiSubagentUi` instances.
2. Decide on one UI authority model.
3. Remove ambiguous shared-state behavior instead of stacking more patches on top.
4. Verify in live Pi, not just TypeScript.
5. Update `docs/features/Pi_Takomi_Command_Center.md` with the final architecture.

## Minimal Repro To Validate

1. `/reload`
2. Fresh Pi session
3. Launch 3 valid Takomi subagents with distinct `conversationId`s
4. Confirm the widget shows all tracked runs
5. Press `Alt+N` repeatedly and verify focus actually changes
6. Press `Alt+T` repeatedly and verify each visible mode transition
7. Press `Alt+Shift+T` and verify fullscreen mounts for the focused run

## Final Instruction To The Next Agent

Prefer an architectural correction over another local patch.

If the true fix is to remove one of the two `TakomiSubagentUi` owners and route everything through a single controller, do that.
