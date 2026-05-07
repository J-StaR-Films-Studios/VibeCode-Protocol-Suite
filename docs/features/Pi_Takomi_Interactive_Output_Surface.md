# Pi Takomi Interactive Output Surface

## Goal

Make the Takomi subagent output surface feel like Pi's native live-agent interface instead of a truncated widget dump.

The active view should:
- show the current call stack clearly when two or more runs are active
- keep the below-editor widget compact enough to avoid Pi's truncation behavior
- make `Alt+T` lead into a usable detailed view rather than an oversized static panel
- support manual scrolling in fullscreen while preserving auto-follow for new output when the user has not scrolled away

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/subagent-types.ts`
  - add render state for output viewport and auto-follow behavior
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - track per-focus scroll state for fullscreen detail mode
  - keep expanded widget bounded and biased toward active stack visibility
- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - redesign expanded rendering into a Pi-like stacked surface
  - add fullscreen scrolling, viewport slicing, and auto-follow rules
  - keep only a short live tail in the widget while reserving full detail for fullscreen
- `.pi/extensions/takomi-runtime/index.ts`
  - align `Alt+T` and fullscreen commands with the new interaction model

### Docs
- `.pi/README.md`
  - document the updated `Alt+T` behavior and fullscreen scrolling controls
- `docs/design/Takomi_TUI_Design_Spec.md`
  - align the spec with the bounded widget plus interactive fullscreen model

## Data Flow

1. A Takomi run starts and streams assistant prose plus runtime activity.
2. The controller keeps a focused run, lineage path, peer runs, and a fullscreen scroll offset.
3. The below-editor widget renders only a compact stack:
   - ancestor/current calls
   - short summary
   - short output tail
   - recent activity tail
4. When the user expands detail, the renderer opens or switches to an interactive fullscreen surface.
5. Fullscreen computes a scrollable list of rendered lines for:
   - call stack
   - checklist
   - prose output
   - activity
   - peer/background runs
6. If the user has not scrolled away, new output keeps the viewport pinned to the live tail.
7. If the user scrolls up, auto-follow pauses until they return to the bottom or toggle back.

## Database Schema

No database changes.

State remains session-local and runtime-only inside the Takomi Pi controller.

## Regression Risks

- An aggressive default to fullscreen could make quick glance usage worse if compact mode becomes harder to reach.
- Scroll state must reset predictably when focus changes between runs.
- Auto-follow must not fight the user while they inspect earlier output.
- Widget compaction must still preserve enough context to show parent/child baton passing.

## Acceptance Criteria

- `Alt+T` no longer lands the user in a visibly truncated expanded widget for normal multi-run activity.
- The below-editor surface shows at least the focused run plus one related/background run when available, without overwhelming the editor.
- Fullscreen supports keyboard scrolling through the rendered output surface.
- Fullscreen auto-follows new output until the user scrolls away from the live tail.
- The focused run's output remains readable prose, while runtime noise stays visually secondary.
- `pnpm exec tsc --noEmit` passes.

## Implementation Notes

- Prefer a bounded, Pi-like call-stack composition over a raw log dump.
- Keep widget height intentionally short; detailed reading belongs in fullscreen.
- Add explicit scroll controls such as arrow keys, `j`/`k`, and page up/page down where supported.
- Preserve existing focus cycling shortcuts.
- Implemented a bounded expanded widget that shows only the focused stack snapshot, summary, short live output, and short recent activity.
- Implemented fullscreen viewport scrolling with live-tail auto-follow that resumes at the bottom and pauses once the user scrolls away.
- Reduced fullscreen overlay height so the detailed view remains stable instead of feeling like a second oversized widget.
