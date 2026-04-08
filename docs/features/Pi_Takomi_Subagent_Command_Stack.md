# Pi Takomi Subagent Command Stack

## Goal

Stabilize Takomi subagent controls in Pi by replacing the current multi-owner UI model with one shared controller and a bottom-of-screen call-stack surface.

This pass fixes focus/fullscreen ownership bugs, keeps existing Takomi workflow semantics intact, and makes the bottom stack the canonical subagent interaction area while the right-side context panel remains secondary.

## Client / Runtime Components

### Shared controller
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - own the single run registry
  - own focused run selection
  - own the active view mode and last non-fullscreen mode
  - own fullscreen overlay lifecycle
  - refresh status/widget output from one place
  - derive active lineage path and peer summaries

### Shared rendering
- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - render compact, expanded, and fullscreen views for the bottom command stack
  - render focused-path and peer summaries from controller-derived run data
  - keep fullscreen overlay presentation controller-owned rather than instance-owned

### Shared types
- `.pi/extensions/takomi-runtime/subagent-types.ts`
  - define controller-owned run state
  - define view and focus types used by runtime and tool launch paths

### Runtime integration
- `.pi/extensions/takomi-runtime/index.ts`
  - reset the shared controller once at session start
  - route runtime-board redispatch events into the shared controller
  - bind all Takomi subagent commands and shortcuts to the shared controller

### Tool integration
- `.pi/extensions/takomi-subagents/index.ts`
  - send direct `takomi_subagent` runs into the shared controller
  - preserve current tool parameters and chain semantics

### Compatibility layer
- `.pi/extensions/takomi-runtime/ui.ts`
  - keep runtime HUD/footer helpers
  - remove subagent state ownership

## Single-Controller Ownership Model

The Takomi subagent surface now has exactly one owner:

- one run registry
- one focused run
- one view mode
- one fullscreen overlay
- one widget/status key

No command or shortcut should broadcast across several `TakomiSubagentUi` instances. The correct owner is resolved by `getTakomiSubagentController()`.

## Controller Run Shape

Each tracked run is controller-owned and uses this shape:

- `runKey: string`
- `conversationId?: string`
- `parentTaskId?: string`
- `parentRunKey?: string`
- `agent: string`
- `taskLabel: string`
- `status: running | completed | blocked`
- `stage?: string`
- `workflow?: string`
- `model?: string`
- `checklist?: ChecklistInput`
- `summary?: string`
- `logs: string[]`
- `startedAt: number`
- `updatedAt: number`
- `source: "runtime-board" | "takomi-tool"`

## Bottom-Stack Rendering Model

### Compact
- one header line showing active run count and focused position
- up to three condensed stack cards
- focused run shown brightest
- ancestors and older roots dimmed
- focused run gets a single short summary line
- no large log tail

### Expanded
- active path rendered as a vertical stack near the command line
- ancestor cards stay visible but condensed
- focused leaf card expands to show metadata, checklist progress, and a short log tail
- unrelated concurrent runs render in `Other Active` as collapsed one-line entries

### Fullscreen
- same stack model in an overlay
- focused run expands fully
- ancestors and peers stay visible
- overlay lifecycle remains controller-owned

## Hybrid Lineage Behavior

Lineage resolution rules for this pass:

- runtime-board redispatch uses `parentTaskId` when present
- runtime-board redispatch also sets `parentRunKey` when the parent is already known locally
- direct/tool runs without lineage become roots in activity order
- sequential tool chains remain sequential roots unless real lineage already exists upstream
- if a parent completes while a child stays active, the parent remains dimmed in-path
- if lineage is missing, the controller falls back to activity ordering instead of inventing fake nesting

## Data Flow

1. A runtime-board or `takomi_subagent` launch path starts a run through `getTakomiSubagentController()`.
2. The controller registers or updates the run, focuses it, and refreshes status/widget output.
3. The controller derives a focused path from real parent lineage when available and activity ordering when not.
4. The renderer converts that derived state into compact, expanded, or fullscreen output anchored near the command line.
5. Completion and blocked states stay visible until newer activity displaces them or the session resets.

## Validation Checklist

- [x] New feature doc created before code changes
- [x] Runtime and tool launch paths share one controller
- [ ] `Alt+T` cycles `compact -> expanded -> fullscreen -> compact`
- [ ] `Alt+Shift+T` opens fullscreen for the current focus without changing focus
- [ ] `Alt+N` and `Alt+P` cycle visible controller runs only
- [ ] Fullscreen closes with `Esc` and returns to the prior non-fullscreen mode
- [x] Blocked runs never auto-collapse
- [x] Completed runs remain visible until displaced by newer activity
- [x] Right-side context panel remains secondary and non-capturing
- [x] `pnpm exec tsc --noEmit` passes

## Implementation Notes

- Added a shared controller at `.pi/extensions/takomi-runtime/subagent-controller.ts` and moved the controller-owned state contract into `.pi/extensions/takomi-runtime/subagent-types.ts`.
- Added `.pi/extensions/takomi-runtime/subagent-render.ts` to render compact, expanded, and fullscreen stack variants from one derived controller state.
- Rewired `.pi/extensions/takomi-runtime/index.ts` and `.pi/extensions/takomi-subagents/index.ts` to call `getTakomiSubagentController()` instead of creating separate UI owners.
- Reduced `.pi/extensions/takomi-runtime/ui.ts` to runtime HUD/footer compatibility only.
- Live Pi verification for focus cycling and overlay behavior is still pending.
