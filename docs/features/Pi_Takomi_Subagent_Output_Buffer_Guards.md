# Pi Takomi Subagent Output Buffer Guards

## Goal

Prevent Takomi multi-agent runs from crashing the Pi extension process when a delegated subagent emits a large JSON event stream.

The failure shown in the runtime screenshot is a `RangeError: Invalid string length` raised while the extension keeps appending every stdout line into one in-memory string during JSON-mode execution.

This pass keeps live UI updates and final assistant extraction intact while replacing unbounded output accumulation with bounded tail buffering.

## Components

### Client / Runtime
- `.pi/extensions/takomi-subagents/index.ts`
  - guard the direct `takomi_subagent` JSON runner against unbounded stdout growth
  - preserve final assistant text extraction for successful runs
  - keep a bounded fallback tail for error reporting

- `.pi/extensions/takomi-runtime/shared.ts`
  - apply the same guard to the shared JSON runner used by runtime-board orchestration paths
  - keep stderr capture bounded so noisy failures do not exhaust memory

### UI
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - no behavioral change expected
  - continues to receive incremental summarized log lines from the JSON stream

## Data Flow

1. A Takomi subagent starts in JSON mode.
2. The runner reads stdout incrementally and parses each JSON line.
3. Live event summaries continue flowing into the runtime UI as before.
4. Instead of concatenating the full raw stream forever, the runner keeps:
   - the final assistant text when available
   - a bounded tail of recent raw output for fallback/error reporting
   - a bounded stderr tail
5. The subagent completes or fails without risking extension-process string explosion.

## Database Schema

No database is involved.

Persistent task/session layout remains file-based and unchanged.

## Regression Risks

- If the final assistant message is missing, fallback output will now contain only the recent tail instead of the full raw JSON stream.
- Tail limits must be large enough to keep useful debugging context for failures.
- Both JSON runners must stay behaviorally aligned so direct-tool and runtime-board launches fail the same way.

## Acceptance Criteria

- Large or chatty subagent runs no longer crash with `RangeError: Invalid string length`.
- Live subagent UI updates still appear during the run.
- Successful runs still return the final assistant text when present.
- Failed runs still include a useful bounded fallback output tail.
- `pnpm exec tsc --noEmit` passes.

## Implementation Notes

- Added a shared `appendCappedTail()` helper in both JSON runner implementations.
- Bounded raw stdout fallback capture to the most recent `64_000` characters instead of storing the entire JSON stream.
- Bounded stderr capture to the same tail size for noisy failures.
- Preserved final assistant message extraction so successful runs still return the real assistant output instead of the raw stream tail.

## Verification

- `pnpm exec tsc --noEmit`
