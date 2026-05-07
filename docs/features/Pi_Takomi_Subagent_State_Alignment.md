# Pi Takomi Subagent State Alignment

## Goal

Make the Takomi subagent surface reflect the difference between:

- a subagent process/run finishing
- the board task actually being completed
- the live checklist state attached to that board task

The UI should not show a board-backed run as `COMPLETED` when the board task is still `in-progress` and its checklist is still incomplete.

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/index.ts`
  - send board-task status and checklist state into the shared subagent controller
  - refresh the live run card when `takomi_board update_task` changes checklist or status
  - keep redispatch/run lifecycle updates separate from board acceptance

### Shared Subagent State
- `.pi/extensions/takomi-runtime/subagent-types.ts`
  - extend runtime state with board-task status metadata

### Shared Controller
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - retain both run lifecycle state and board-task state in the same tracked run

### Shared Rendering
- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - derive labels from both run status and board task status
  - show a board-backed run as `RUNNING`, `FINISHED`, `COMPLETED`, or `BLOCKED` based on the combined state
  - keep checklist progress tied to the latest board-side checklist when available

## Data Flow

1. A board-backed task is redispatched.
2. The subagent controller starts a live run with:
   - run lifecycle status
   - board task status
   - checklist snapshot
3. While the subagent executes, log/model/summary updates change the run lifecycle state.
4. When the subagent process ends successfully:
   - the run becomes `finished`
   - the board task may still remain `in-progress`
5. When `takomi_board update_task` changes checklist or status:
   - the board task state is pushed back into the controller
   - the panel updates to reflect the durable checklist and durable board status
6. A board-backed run only renders as `COMPLETED` when the board task itself is completed.

## Database Schema

No database is involved.

Persistent session/task state remains file-based in the existing Takomi session files.

This pass only aligns the live runtime view model with existing board state.

## Validation Checklist

- [x] Feature doc created before code changes
- [x] Board-backed runs distinguish `finished` from board `completed`
- [x] Board-backed checklist progress updates appear in the live subagent surface after `update_task`
- [x] Board-backed blocked tasks appear blocked in the live subagent surface
- [x] Non-board direct subagent runs still render sensible statuses
- [x] `pnpm exec tsc --noEmit` passes

## Implementation Notes

- This pass does not move ownership of truth away from the board. The board remains the durable task/checklist authority.
- The subagent panel becomes a synchronized runtime projection of that authority for board-backed runs.
- Direct `takomi_subagent` runs without board tasks still rely on run lifecycle state only.
- The UI still does not tick checklist items directly. Checklist progress must still be updated through board/task actions; this pass makes the live panel reflect those updates correctly.
