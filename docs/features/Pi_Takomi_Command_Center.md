# Pi Takomi Command Center

## Goal

Repair and finish the Takomi Pi TUI overhaul so the runtime loads cleanly, the footer stays pinned, the active subagent surface uses a single shared controller, and the bottom command stack supports compact, expanded, and fullscreen modes without fighting the context sidebar.

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/index.ts`
  - own Takomi runtime state, footer installation, command registration, and session wiring
  - reset and drive the shared subagent controller from runtime-board flows
  - consume direct subagent lifecycle events from the shared Pi event bus
  - keep footer installation one-time and feed it live state through references
- `.pi/extensions/takomi-runtime/ui.ts`
  - render the Takomi HUD widget above the editor
  - remain a thin compatibility layer for runtime HUD/footer helpers rather than subagent ownership
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - own the canonical subagent registry, focus state, view mode, and fullscreen lifecycle
- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - render the bottom command stack for compact, expanded, and fullscreen modes
- `.pi/extensions/takomi-runtime/subagent-types.ts`
  - define controller-owned run and view types shared across launch paths
- `.pi/extensions/takomi-runtime/context-panel.ts`
  - render a non-capturing right-side overlay with session context
  - track file edits and tool activity from runtime events
- `.pi/extensions/takomi-runtime/shared.ts`
  - host shared string, checklist, model-preflight, prompt, and Pi-process utilities used by both runtime and subagent extensions
- `.pi/extensions/takomi-subagents/index.ts`
  - continue to use shared helpers without duplicating process/model helper logic
  - emit direct subagent lifecycle events so the runtime extension remains the single UI owner

### Docs
- `docs/features/Pi_Takomi_Command_Center.md`
  - track implementation notes and completion status for the broader Pi Takomi runtime work
- `docs/features/Pi_Takomi_Subagent_Command_Stack.md`
  - track the single-controller command-stack refactor

## Data Flow

1. Pi starts a session and loads the Takomi runtime extension.
2. `index.ts` restores persisted Takomi state, installs the footer once, and refreshes the HUD widget.
3. When a delegated task starts, the shared controller renders a sticky widget below the editor and updates the footer status.
4. Multiple delegated runs are tracked in one controller-owned registry rather than by several UI owners.
5. `Alt+T` or `/takomi-subagent-toggle` cycles `compact -> expanded -> fullscreen -> compact`.
6. `Alt+N` / `Alt+P` and `/takomi-subagent-next` / `/takomi-subagent-prev` switch focus between controller-visible runs.
7. Fullscreen mode uses a controller-owned Pi overlay and returns to the prior non-fullscreen mode when dismissed with `Esc`.
8. Runtime-board tasks use real parent lineage when available and fall back to activity ordering when not.
9. On session start, the context overlay can still auto-open on the right when the terminal is wide enough, but the bottom stack remains the primary subagent surface.
10. `tool_result` events feed the context panel with recent file mutations and tool counts.

## Database Schema

No database changes.

State remains session-local plus Takomi's existing file-based session artifacts under `.pi/takomi/`.

## Risks / Regressions

- Pi overlay handling must match the real extension API or overlays will stay open or steal focus incorrectly.
- The runtime footer must stay two lines max or it will reflow awkwardly.
- Narrow terminals may need overlays hidden automatically to avoid collisions with the editor.
- The repo-level Genesis docs referenced by Takomi prompts are currently incomplete or missing, so lifecycle helpers must fail soft.

## Completion Notes

- [x] Remove malformed duplicate helper code from `index.ts`
- [x] Align runtime UI with Pi overlay/widget APIs
- [ ] Verify context panel auto-opens and toggles correctly in live Pi
- [x] Replace multi-owner subagent state with a single shared controller
- [ ] Ensure subagent toggle flow matches the command-stack plan
- [x] Preserve multiple concurrent subagents with focus, lineage, and bottom-stack rendering
- [x] Pass `pnpm exec tsc --noEmit`

## Implementation Update

- Footer installation now uses a dedicated `TakomiFooterComponent` and is still installed only once.
- The next repair pass moves subagent ownership out of `ui.ts` and into a single shared controller consumed by both runtime-board and `takomi_subagent`.
- The bottom-of-screen call stack becomes the canonical subagent surface, with the right-side context panel kept secondary.
- `Alt+T`, fullscreen, and focus cycling should resolve against exactly one controller instead of fanning out across several UI instances.
- Hybrid hierarchy will use true parent/child lineage where `parentTaskId` exists and fall back to activity order for direct/tool runs.
- The repo-level Genesis documents expected by legacy Takomi prompts are still missing from `docs/`; the runtime continues to fail soft and treat Genesis as incomplete.
