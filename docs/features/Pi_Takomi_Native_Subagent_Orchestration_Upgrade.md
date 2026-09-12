# Pi Takomi Native Subagent Orchestration Upgrade

## Goal

Make Takomi's native Pi orchestration feel deliberate instead of noisy. Broad work should fan out automatically in auto mode, while manual mode should expose a clear delegation plan before launch so the user can inspect or adjust agent, task, model, thinking level, and review behavior.

When Takomi creates subtasks, roadbook tasks, or an orchestration session, Pi should use `takomi_subagent` by default for implementation and a separate review pass. The main agent remains the orchestrator: it synthesizes results, updates the roadbook/board, decides whether to accept or redispatch, and handles the final user handoff.

This pass keeps Takomi's existing board, agents, and session model while using native `pi-subagents` as the execution and result-rendering backend. `pi-subagents` is a direct runtime dependency pinned to `0.31.0`; Takomi isolates its internal imports behind a local compatibility adapter while retaining orchestration, routing, trust gates, and lifecycle semantics.

## Components

- Shared core types define launch modes, run placement, and a `TakomiDelegationPlan` whose tasks carry the canonical execution `cwd`.
- `.pi/takomi-profile.json` stores neutral project defaults, including launch mode and review behavior.
- `.pi/extensions/takomi-subagents/delegation-plan.ts` builds and renders delegation plans for board redispatch and direct subagent calls, including the exact canonical working directory shown before launch.
- `.pi/extensions/takomi-subagents/pi-subagents-internal.ts` isolates the pinned `pi-subagents@0.31.0` internal imports used by the native execution and rendering backend.
- `takomi_board` uses the plan before redispatch and honors manual mode with `confirmLaunch`.
- `takomi_subagent` uses the same plan shape for direct, parallel, and chained subagent launches.
- The runtime command layer exposes launch-mode and subagent stack controls.
- The active subagent controller keeps compact, expanded, and fullscreen views for multi-agent work.

## Data Flow

1. Takomi resolves the top-level run `cwd`. Omission inherits Pi's current/default project; a relative value must remain contained by that project; an explicit absolute value may select another existing directory.
2. Takomi canonicalizes the accepted directory through filesystem realpath resolution, then loads that project root's Takomi profile and optional read-only user overrides.
3. A board redispatch or direct subagent call resolves agent, model, fallback models, thinking, checklist, conversation id, review preference, and each task's canonical `cwd`. An omitted task `cwd` inherits the run root, a relative task `cwd` remains contained by its parent, and an explicit absolute task `cwd` may be external.
4. Paths written only in task prose do not alter execution. An obvious prose/`cwd` mismatch blocks with corrective feedback rather than inferring a directory.
5. Takomi creates a `TakomiDelegationPlan`; both rendered previews and `details.plan.tasks[*].cwd` expose the same canonical directory that will be forwarded to execution.
6. In `auto` mode, dispatch proceeds immediately. In `manual` mode, Takomi returns the plan unless `confirmLaunch=true` is provided.
7. Dispatch uses Takomi's local adapter over pinned `pi-subagents@0.31.0`, preserving exact-model preflight, thinking levels, explicit fallback behavior, native user/project agent discovery, stable conversation ids, process execution, live results, and native rendering.
8. Project-agent trust gates remain active for external roots, and changing `cwd` does not auto-load executable extensions from the target project.
9. A reviewer run checks implementation output before the orchestrator accepts or redispatches the task.
10. Runtime events update the compact active-agent stack and fullscreen detail view.

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
- Decomposed orchestration defaults to implementer and reviewer `takomi_subagent` runs.
- The main orchestrator owns final synthesis, board updates, acceptance, redispatch, and user handoff.
- Plans show agent, task, canonical `cwd`, model, thinking, workflow, checklist progress, review state, and launch mode.
- The canonical `cwd` in rendered preview text, structured `details.plan.tasks[*].cwd`, launch approval fingerprints, and native execution agrees.
- Omitting `cwd` preserves same-project inheritance; contained relative directories work; explicit absolute existing directories outside the parent workspace are supported.
- Missing directories, regular files, relative traversal, and relative symlink/junction escapes are rejected before launch.
- Task prose alone never changes `cwd` and obvious mismatches block without automatic path inference.
- External directories do not bypass project-agent trust gates or trigger automatic loading of target-project extensions. Nested project-agent definitions and project settings that override canonical personas are project-controlled inputs and require authorization.
- Native `resume` cannot bypass project-agent authorization when reviving work under a project-controlled root.
- Redispatch still reuses `conversationId`.
- Active subagent UI still supports minimized, expanded, fullscreen, and focus switching.
- Exact-model preflight, explicit fallback models, and thinking-level behavior remain intact through the pinned native `pi-subagents@0.31.0` adapter.

## Known Async Boundary

Live detached async launches preserve canonical external working directories through native launch and handoff. Cross-restart result hydration across multiple project roots is not part of the current guarantee. That requires future integrity-bound provenance for canonical roots, run identities, sessions, and result/artifact locations; path confinement and trust checks must not be weakened to approximate it.

## Regressions To Watch

- Do not write user profile files outside the repo.
- Do not hard-code personal model choices.
- Do not break `.pi/agents/*.md` prompt discovery.
- Do not require manual preview in auto mode.
- Do not force subagents for small one-shot tasks or when the user explicitly says "do it yourself", "no subagents", or "no new threads".
- Do not lose session continuity during review-and-redispatch.
- Keep raw tool chatter secondary in compact and expanded modes.
