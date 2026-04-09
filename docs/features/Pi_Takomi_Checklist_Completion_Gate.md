# Pi Takomi Checklist Completion Gate

## Goal

Prevent Takomi board tasks from being marked `completed` until the task checklist has actually been updated and all checklist items are done.

This closes the gap between:

- prompt-level guidance that says an agent should update acceptance criteria
- runtime behavior that currently allows a task status flip to `completed` without checklist validation

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/index.ts`
  - enforce the completion gate in `takomi_board`
  - allow checklist replacement on task updates so an unfinished task can be brought into compliance
  - return explicit validation errors when completion is blocked

### Shared Core
- `src/pi-takomi-core/orchestration.ts`
  - continue rendering checklist state in task artifacts
  - no schema migration needed for persisted session files

### Subagent Surface
- `.pi/extensions/takomi-subagents/index.ts`
  - avoid implying that a successful subagent process means the board task itself is complete
- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - keep process/run completion separate from board-task completion

## Data Flow

1. A Takomi task is updated through `takomi_board`.
2. The runtime computes the resulting checklist state from:
   - optional full checklist replacement
   - optional checklist item updates
3. If the requested status is not `completed`, the update proceeds normally.
4. If the requested status is `completed`, the runtime validates:
   - a checklist exists
   - every checklist item is marked done
5. If validation fails:
   - the task remains unchanged
   - the tool returns a clear error with the incomplete checklist items
6. If validation passes:
   - the task status becomes `completed`
   - task docs and machine state are regenerated

## Database Schema

No database is involved.

Persistent state remains file-based:

- `docs/tasks/orchestrator-sessions/<sessionId>/`
- `.pi/takomi/orchestrator/<sessionId>.json`

The task shape stays compatible. This pass only tightens runtime validation.

## Validation Checklist

- [x] Feature doc created before code changes
- [x] `takomi_board update_task` rejects `completed` when checklist is missing
- [x] `takomi_board update_task` rejects `completed` when any checklist item is incomplete
- [x] `takomi_board update_task` accepts checklist replacement plus checklist updates in one call
- [x] Successful subagent process text no longer implies board task completion
- [x] `pnpm exec tsc --noEmit` passes

## Implementation Notes

- The hard gate is intentionally placed in the board update path, because that is where durable task status changes happen.
- Direct subagent process success remains useful runtime information, but it should be framed as run completion, not board-task completion.
- This pass enforces checklist completion only. `definitionOfDone` remains advisory text because it is not currently modeled as mutable per-item state.
- `update_task` now accepts an optional full `checklist` payload in addition to `checklistUpdates`, so a task can be brought into compliance in one tool call before completion is retried.
