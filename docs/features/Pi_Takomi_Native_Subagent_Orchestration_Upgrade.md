# Pi Takomi Native Subagent Orchestration Upgrade

## Goal

Make Takomi's native Pi orchestration feel deliberate instead of noisy. Broad work should fan out automatically in auto mode, while manual mode should expose a clear delegation plan before launch so the user can inspect or adjust agent, task, model, thinking level, and review behavior.

This pass keeps Takomi's existing board, agents, and session model. It borrows the useful planning ideas from Pi subagent patterns without taking a runtime dependency on `pi-subagents`.

## Components

- Shared core types define launch modes, run placement, and a `TakomiDelegationPlan`.
- `.pi/takomi-profile.json` stores neutral project defaults, including launch mode and review behavior.
- `.pi/extensions/takomi-subagents/delegation-plan.ts` builds and renders delegation plans for board redispatch and direct subagent calls.
- `takomi_board` uses the plan before redispatch and honors manual mode with `confirmLaunch`.
- `takomi_subagent` uses the same plan shape for direct and chained subagent launches.
- The runtime command layer exposes launch-mode and subagent stack controls.
- The active subagent controller keeps compact, expanded, and fullscreen views for multi-agent work.

## Data Flow

1. Pi loads the project Takomi profile, then optional read-only user overrides.
2. A board redispatch or direct subagent call resolves agent, model, fallback models, thinking, checklist, conversation id, and review preference.
3. Takomi creates a `TakomiDelegationPlan`.
4. In `auto` mode, dispatch proceeds immediately.
5. In `manual` mode, Takomi returns the plan unless `confirmLaunch=true` is provided.
6. Dispatch uses the existing `dispatchTakomiSubagent` adapter, preserving model preflight, `--thinking`, fallback behavior, prompt loading from `.pi/agents/*.md`, and stable conversation ids.
7. Runtime events update the compact active-agent stack and fullscreen detail view.

## Schema

Profile additions:

```json
{
  "launchMode": "auto",
  "foreground": true,
  "background": true,
  "reviewAfterImplementation": true
}
```

Shared type additions:

- `TakomiLaunchMode = "auto" | "manual"`
- `TakomiRunPlacement = "foreground" | "background"`
- `TakomiDelegationPlan`
- `TakomiDelegationPlanTask`

Board/direct dispatch additions:

- `confirmLaunch`
- `previewOnly`
- board overrides for `preferredAgent`, `preferredModel`, `preferredThinking`, and `includeReview`

## Commands

- `/takomi-launch-mode auto`
- `/takomi-launch-mode manual`
- `/takomi-subagents-status`
- `/takomi-subagents-minimize`
- `/takomi-subagents-fullscreen`
- `/autoorch` remains the quick toggle and now maps enabled to auto launch and disabled to manual preview.

## Acceptance Criteria

- Manual mode returns a readable delegation plan instead of launching immediately.
- Auto mode still launches without an extra confirmation step.
- Board redispatch and direct `takomi_subagent` calls share the same plan shape.
- Plans show agent, task, model, thinking, workflow, checklist progress, review state, and launch mode.
- Redispatch still reuses `conversationId`.
- Active subagent UI still supports minimized, expanded, fullscreen, and focus switching.
- Model preflight and thinking-level behavior stay on the existing dispatch path.

## Regressions To Watch

- Do not write user profile files outside the repo.
- Do not hard-code personal model choices.
- Do not break `.pi/agents/*.md` prompt discovery.
- Do not require manual preview in auto mode.
- Do not lose session continuity during review-and-redispatch.
- Keep raw tool chatter secondary in compact and expanded modes.
