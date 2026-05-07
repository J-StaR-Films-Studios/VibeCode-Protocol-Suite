# Pi Takomi Streamed Output Rendering

## Goal

Fix the Pi Takomi runtime so active subagent output renders like natural wrapped prose instead of a stack of tiny log entries, and make queued/background summaries reflect that same readable text.

The root problem is structural, not just wrapping. The JSON-mode subagent stream emits assistant text and runtime/tool events through the same live log path. Even after token coalescing, the UI still behaves like a log viewer, so the focused `Output:` area shows fragmented chunks instead of a real paragraph.

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/shared.ts`
  - classify JSON stream updates into assistant text snapshots vs event log lines
  - preserve bounded fallback output capture
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - store live assistant prose separately from discrete runtime events
  - stop using the event log as the canonical assistant output source
- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - render `Output:` as wrapped paragraph text sourced from the assistant output buffer
  - render runtime/tool noise in a separate `Activity:` block
  - derive summaries from assistant prose first, then fall back to summary/event text

### Tool Runtime
- `.pi/extensions/takomi-subagents/index.ts`
  - keep direct-tool JSON stream handling aligned with runtime-board launches
  - emit assistant output snapshots separately from activity log events

## Data Flow

1. A Takomi subagent starts in JSON mode.
2. Pi emits incremental `message_update` deltas while the assistant is still composing text.
3. The runtime parser turns those deltas into a current assistant-output snapshot instead of pushing them into the event log.
4. Tool lifecycle messages, stderr, and other runtime noise stay in the event log.
5. The focused run renders the assistant-output snapshot as wrapped paragraphs under `Output:`.
6. If activity exists, it renders separately under `Activity:`.
7. Background/queued cards summarize from assistant prose first, so they no longer collapse to the latest token or tool log.

## Database Schema

No database changes.

State remains session-local and file-based under `.pi/takomi/`.

## Regression Risks

- Assistant output snapshots must not duplicate or repeatedly reset while streaming.
- Tool lifecycle messages like `Tool start:` or `Tool complete:` must remain discrete event entries.
- Error and stderr lines must not leak into the main prose block unless they are the only returned output.
- Runtime-board and direct `takomi_subagent` launches must stay behaviorally aligned.

## Acceptance Criteria

- Active `Output:` renders as wrapped paragraph text rather than one event per line.
- `Summary:` and background/queued entries reflect readable assistant prose rather than the latest token or tool event.
- Tool/status log lines render separately in `Activity:` instead of polluting the prose block.
- `pnpm exec tsc --noEmit` passes.

## Implementation Notes

- Added assistant-output snapshot handling to both JSON-mode runners so `message_update`/`message_end` events update a dedicated `outputText` field instead of appending into `logs`.
- Kept discrete runtime activity in `logs`, with the existing capped-log behavior preserved for tool/status/stderr lines.
- Updated the focused-run renderer to show a wrapped paragraph block under `Output:` and a separate `Activity:` section for runtime noise.
- Updated summary selection to prefer assistant prose first so queued/background entries stay readable while a run is streaming.

## Verification

- `pnpm exec tsc --noEmit`
