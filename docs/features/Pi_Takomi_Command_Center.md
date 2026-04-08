# Pi Takomi Command Center

## Goal

Repair and finish the Takomi Pi TUI overhaul so the runtime loads cleanly, the footer stays pinned, the active subagent surface supports compact, expanded, and fullscreen modes, and the context sidebar can be toggled without breaking the session.

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/index.ts`
  - own Takomi runtime state, footer installation, command registration, and session wiring
  - route subagent view toggles across compact, expanded, and fullscreen
  - keep footer installation one-time and feed it live state through references
- `.pi/extensions/takomi-runtime/ui.ts`
  - render the Takomi HUD widget above the editor
  - render sticky subagent cards below the editor
  - launch and dismiss fullscreen subagent overlays with Pi `custom(..., { overlay: true })`
- `.pi/extensions/takomi-runtime/context-panel.ts`
  - render a non-capturing right-side overlay with session context
  - track file edits and tool activity from runtime events
- `.pi/extensions/takomi-runtime/shared.ts`
  - host shared string, checklist, model-preflight, prompt, and Pi-process utilities used by both runtime and subagent extensions
- `.pi/extensions/takomi-subagents/index.ts`
  - continue to use shared helpers and the runtime subagent UI without duplicating process/model helper logic

### Docs
- `docs/features/Pi_Takomi_Command_Center.md`
  - track implementation notes and completion status for this repair

## Data Flow

1. Pi starts a session and loads the Takomi runtime extension.
2. `index.ts` restores persisted Takomi state, installs the footer once, and refreshes the HUD widget.
3. When a delegated task starts, `TakomiSubagentUi` renders a sticky widget below the editor and updates the footer status.
4. Multiple delegated runs are now tracked by conversation/thread id instead of sharing one global subagent card.
5. `Alt+T` or `/takomi-subagent-toggle` cycles compact -> expanded -> fullscreen -> compact.
6. `Alt+N` / `Alt+P` and `/takomi-subagent-next` / `/takomi-subagent-prev` switch focus between tracked subagents.
7. Fullscreen mode uses a Pi overlay component and returns to compact mode when dismissed.
8. On session start, the context overlay now auto-opens on the right when the terminal is wide enough, and `Alt+C` or `/takomi-context` toggles it afterward.
9. `tool_result` events feed the context panel with recent file mutations and tool counts.

## Database Schema

No database changes.

State remains session-local plus Takomi’s existing file-based session artifacts under `.pi/takomi/`.

## Risks / Regressions

- Pi overlay handling must match the real extension API or overlays will stay open or steal focus incorrectly.
- The runtime footer must stay two lines max or it will reflow awkwardly.
- Narrow terminals may need overlays hidden automatically to avoid collisions with the editor.
- The repo-level Genesis docs referenced by Takomi prompts are currently incomplete or missing, so lifecycle helpers must fail soft.

## Completion Notes

- [x] Remove malformed duplicate helper code from `index.ts`
- [x] Align runtime UI with Pi overlay/widget APIs
- [ ] Verify context panel auto-opens and toggles correctly in live Pi
- [x] Ensure subagent toggle flow matches the command-center plan
- [x] Preserve multiple concurrent subagents instead of overwriting a single panel state
- [x] Pass `pnpm exec tsc --noEmit`

## Implementation Update

- Footer installation now uses a dedicated `TakomiFooterComponent` and is still installed only once.
- `Alt+T` now cycles compact -> expanded -> fullscreen -> compact.
- Fullscreen subagent overlays request rerenders while open so elapsed time and live output can refresh.
- Fullscreen commands and shortcuts now rebind against the current live Pi UI context, so `Alt+T` and `/takomi-subagent-fullscreen` can mount the overlay immediately instead of only flipping an internal mode flag.
- Subagent UI state is now keyed by conversation/thread id, so concurrent or sequential delegated runs no longer overwrite one another in-memory.
- Compact mode now shows a deeper log tail for the focused agent and includes peer agent summaries when more than one subagent is active.
- The runtime now exposes explicit next/previous subagent cycling commands and shortcuts: `/takomi-subagent-next`, `/takomi-subagent-prev`, `Alt+N`, and `Alt+P`.
- The context panel now keeps a real overlay handle, can close reliably, refreshes while visible, and shows runtime metadata alongside tool/file activity.
- The context panel now auto-opens on session start to match the intended command-center layout instead of staying hidden until manually toggled.
- The repo-level Genesis documents expected by legacy Takomi prompts are still missing from `docs/`; the runtime continues to fail soft and treat Genesis as incomplete.
