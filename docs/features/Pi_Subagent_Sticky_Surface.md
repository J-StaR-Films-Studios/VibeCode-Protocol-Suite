# Pi Subagent Sticky Surface

## Goal

Keep the active Takomi subagent surface sticky near the Pi editor/footer so the user can scroll transcript history without losing the live task context.

Also replace the conflicting expansion hint with a working toggle path that does not collide with the terminal's close-tab shortcut.

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/ui.ts`
  - render the active subagent surface in Pi's `belowEditor` widget area
  - show a working expand/collapse hint
- `.pi/extensions/takomi-runtime/index.ts`
  - register the subagent toggle shortcut on a non-conflicting key

### Docs
- `.pi/README.md`
  - explain the sticky placement and working toggle path
- `docs/design/Takomi_TUI_Design_Spec.md`
  - align the UI description with the actual anchored surface

## Data Flow

1. A Takomi subagent starts or updates.
2. `TakomiSubagentUi` renders the live surface into Pi's widget slot with `placement: "belowEditor"`.
3. The transcript remains scrollable above while the input/footer and active subagent surface stay anchored near each other.
4. The user can expand or collapse the surface with `/takomi-subagent-toggle` or `Alt+T`.

## Database Schema

No database is involved.

Persistent state remains unchanged and file-based only.

## Regression Risks

- A taller expanded panel will consume more bottom-of-screen space than the old placement.
- `Alt+T` may still conflict with a user-customized terminal binding, but it avoids the default Windows close-tab collision reported for `Ctrl+Shift+T`.

## Acceptance Criteria

- Active Takomi subagent UI no longer scrolls away with transcript history.
- The live surface stays near the input/footer while the transcript scrolls independently.
- The default expansion hint matches a real working toggle path.
- Docs describe the sticky behavior accurately.
