# Takomi TUI Design Spec

**Stage:** Design
**Next Recommended Stage:** Build
**Scope:** Pi-native Takomi runtime UI for orchestration, subagent focus, and theme cohesion.

## 1. Objective

Make the Pi-local Takomi experience feel like a deliberate command center instead of a plain stream of tool output.

The UI should:
- make the current Takomi lifecycle state obvious
- elevate subagent work into a focused bottom command-stack moment
- keep completed work visible in summary form until displaced by newer activity
- preserve a premium, dark, terminal-native visual identity
- stay lightweight enough for everyday coding sessions

## 2. Design Intent

### Core vibe
- terminal noir
- premium, calm, intentional
- agentic without feeling noisy
- dark-first, high-contrast, low-clutter

### Experience principles
1. Calm by default: small HUD, minimal chrome.
2. Focus on transitions: when subagent work starts, the UI should feel like attention narrows.
3. Return to calm: success settles into a compact summary instead of leaving big panels open.
4. State should be glanceable: stage, role, session, and active work should be readable in under 2 seconds.
5. Failure stays visible: errors should not auto-minimize.
6. One owner only: subagent view state must be owned by one shared controller.

## 3. Layout Model

The Takomi TUI uses three layers, but the bottom command stack is the canonical subagent interaction surface.

### Layer A - Persistent HUD
**Placement:** above editor + footer status
**Purpose:** always-on situational awareness

Required HUD fields:
- runtime enabled state
- active role
- active stage
- active workflow
- auto-orch state
- plan mode state
- active session id

Behavior:
- compact, always visible
- should not feel like a dashboard wall
- should use short labels and restrained color

### Layer B - Active Agent Stack
**Placement:** directly above the editor / command line
**Purpose:** show active delegation where the user's eyes already are

Required content per card:
- status badge: running / complete / blocked
- agent name
- task id + task title or subject
- lifecycle stage when available
- workflow when available
- model when known
- conversation id when relevant
- checklist progress when available
- latest summary line
- recent output tail kept short

Behavior:
- appears when a subagent starts
- parent agent cards remain visible but dim when a child agent takes focus
- true nested delegation should read like a vertical call stack when lineage exists
- when lineage is absent, runs fall back to root-level activity ordering rather than fake nesting
- the deepest focused active agent becomes the visually dominant card
- successful child completion folds back into the parent context and then into compact summary history
- blocked/failed cards remain visible for intervention
- on narrow terminals, the stack compresses to a minimal summary widget

### Layer C - Secondary Context Panel
**Placement:** right-side non-capturing overlay
**Purpose:** provide runtime context without competing with the bottom command stack

Required content:
- active runtime role, stage, workflow, and session metadata
- recent file edits
- recent tool activity

Behavior:
- stays non-capturing and visually secondary
- can coexist with fullscreen on sufficiently wide terminals
- must not become the primary subagent attention surface

## 4. Interaction Model

### Running flow
1. User or orchestrator dispatches a subagent.
2. An active agent card appears above the command line.
3. If that agent delegates again and lineage is known, the parent dims and a child card appears beneath it.
4. Footer/status reflects active work, but does not become the primary surface.
5. If lineage is not known, the new run is shown as a newer root while focus still tracks the current work.
6. On success, the child folds back into its parent and eventually settles into compact summary history.
7. On failure, the blocked card remains open for rescue and does not auto-minimize.

### Motion rules
This is terminal UI, so motion should be implied rather than animated heavily.

Use:
- appear/disappear transitions via overlay visibility
- status badge changes
- output tail updates

Avoid:
- constant flashing
- decorative spinners everywhere
- overuse of bright colors

## 5. Visual System

### Theme name
`takomi-noir`

### Palette roles
- **Base background:** near-black graphite
- **Surface:** blue-charcoal panel
- **Accent:** cyan for active Takomi identity
- **Genesis:** violet
- **Design:** cyan
- **Build:** amber
- **Success / Review-complete:** jade
- **Blocked / Failure:** coral
- **Muted text:** slate

### Tone guidance
- borders should be visible but soft
- accent color should feel premium, not neon overload
- warning/success/error should read instantly without dominating the entire screen

## 6. Component Rules

### HUD rules
- use one headline line max
- use one compact metadata line max
- keep the session id abbreviated when needed

### Active stack rules
- the active surface should feel attached to the command line, not detached from the transcript
- parent cards should dim rather than disappear when a child becomes active
- nested cards may use slight indentation or a connector line to show baton pass
- the controller should own view mode, focus, and fullscreen lifecycle for every run
- raw output should stay trimmed to a short recent tail
- the deepest active card should always be visually dominant

### Transcript collapse rules
- success state: green/jade emphasis when a task settles into history
- blocked state: coral emphasis and remain interactive
- transcript summaries should remain concise; history is not the place for giant live logs
- completed runs should remain visible in compact or expanded summaries until displaced by newer activity

## 7. Responsive Behavior

### Wide terminals
- show HUD + active stack + context panel

### Medium terminals
- show HUD + compressed active stack
- keep transcript width prioritized over decorative surfaces and secondary panels

### Narrow terminals
- preserve only status line + minimal active summary widget
- never allow the active surface to make the interface unusable

## 8. Implementation Targets

### Files to add
- `.pi/themes/takomi-noir.json`
- `docs/design/Takomi_TUI_Design_Spec.md`
- `.pi/extensions/takomi-runtime/subagent-types.ts`
- `.pi/extensions/takomi-runtime/subagent-render.ts`
- `.pi/extensions/takomi-runtime/subagent-controller.ts`

### Files to modify
- `.pi/extensions/takomi-runtime/index.ts`
- `.pi/extensions/takomi-subagents/index.ts`
- `.pi/extensions/takomi-runtime/ui.ts`

### Shared UI helper recommended
- create a small shared helper module for:
  - runtime HUD formatting
  - active subagent overlay rendering
  - collapsed summary rendering

## 9. V1 Acceptance Criteria

### Theme
- a project-local Pi theme exists at `.pi/themes/takomi-noir.json`
- it defines the full Pi theme token set
- it visually supports the Takomi palette described above

### Runtime HUD
- the existing Takomi runtime widget is upgraded into a more intentional HUD
- footer status becomes more informative and visually consistent

### Subagent focus UI
- dispatching a subagent shows an active sticky surface anchored near the editor/footer instead of drifting with transcript history
- one shared controller owns focus, view state, fullscreen, and status/widget refresh
- nested delegation is visible as parent/child card depth when lineage exists
- the active card includes agent, task, workflow, conversation id, and live/recent output context
- successful completion folds back into the parent and then into visible compact summary state
- failures remain visible instead of auto-minimizing

### Practicality
- the UI remains usable in normal terminal widths
- no breaking change to orchestration logic is introduced
- the design layer is additive, not a rewrite of Takomi behavior

## 10. Future Iterations

Not required for v1, but explicitly desired later:
- restore/minimize hotkey for previously hidden agent cards
- multi-subagent queue or richer stack view
- session board overlay showing Genesis -> Design -> Build progress
- richer checklist progress meter
- dedicated Takomi footer replacing the default footer entirely
- explicit parent/child thread switching when several active agents coexist
- steer-mode input routed directly into the focused worker thread

## 11. Build Notes

The first build pass should prioritize:
1. theme file
2. HUD polish
3. side-panel lifecycle
4. collapsed completion strip

That order gives immediate UX improvement without requiring a full runtime redesign.
