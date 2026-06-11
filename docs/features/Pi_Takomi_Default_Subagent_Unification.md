# Pi Takomi Default Subagent Unification

## Goal

Merge Takomi's lifecycle orchestration with Pi's newer default `subagent` implementation so Pi exposes one clear full-stack lifecycle instead of two parallel systems.

Important ownership rule: Pi's default/user-level `subagent` tool keeps the `subagent` tool name. Takomi must not register that name when the default subagent extension is installed. Takomi's project-local lifecycle-aware wrapper remains `takomi_subagent`, branded as Takomi and rendered with Pi's native-style subagent result surface.

The desired user flow is:

1. User enters Pi.
2. User invokes the top-level Takomi behavior or describes broad work naturally.
3. Takomi captures intent, creates or updates the plan, and waits for final approval when the plan is not yet locked.
4. After approval, Takomi dispatches specialist agents through the default Pi subagent execution model.
5. The active agent stack remains visible and understandable while Genesis, Design, Build, Review, and redispatch loops progress.

The top-level `/takomi` experience should become the canonical entrypoint. The current spread of `/takomi-*` commands should be reduced or hidden behind the primary lifecycle flow so typing `/Takomi` does not surface a noisy list of rarely used implementation commands.

## Context Read

- `docs/project_requirements.md` is currently missing, so this plan treats the existing `docs/features/` files and `.pi/README.md` as the project requirements source for this pass.
- `docs/features/Pi_Takomi_Native_Subagent_Orchestration_Upgrade.md` already defines manual versus auto launch, delegation plans, and shared board/tool dispatch shape.
- `docs/features/Pi_Takomi_Orchestration_Alignment.md` already defines the Genesis -> Design -> Build lifecycle, dynamic stage expansion, and shared-core ownership of orchestration policy.
- `docs/features/Pi_Takomi_Subagent_Command_Stack.md` and `docs/features/Pi_Takomi_Command_Center.md` define the older single-controller bottom stack surface; this pass deprecates that visible surface in favor of Pi's native subagent result UI while keeping internal run tracking for status and board synchronization.
- Pi's default subagent example in `node_modules/@earendil-works/pi-coding-agent/examples/extensions/subagent/` supports single, parallel, and chain modes with user/project/both agent discovery.
- Takomi's current `.pi/extensions/takomi-subagents/` path supports project-local agents, model preflight, thinking levels, fallback models, conversation IDs, checklists, lifecycle metadata, plan previews, and runtime UI events.

## Comparison

### Pi Default Subagent Strengths

- One obvious tool name: `subagent`.
- Supports single, parallel, and chain execution.
- Uses `agentScope` to choose user, project, or both agent directories.
- Prompts before running project-local agents.
- Streams structured progress through `onUpdate`.
- Has concise built-in renderers for single, parallel, and chain results.

### Takomi Current Strengths

- Lifecycle-aware: Genesis -> Design -> Build, with review and redispatch loops.
- Uses a `TakomiDelegationPlan` before launching work.
- Supports manual preview and auto launch.
- Tracks `conversationId` so reviewed work can return to the same agent.
- Adds model preflight, fallback models, thinking level, checklists, workflow, stage, and board status.
- Persists human-readable task docs and machine-readable session state.
- Maintains a visible active subagent stack through a shared runtime controller.

### Merge Direction

Use Pi's default subagent model as the execution substrate and Takomi as the lifecycle/orchestration layer.

In practice:

- Keep the public tool concept close to Pi's default `subagent` shape without taking over the default `subagent` tool id.
- Brand the Takomi wrapper as Takomi where it appears in the project-local runtime.
- Preserve Takomi-only lifecycle metadata and dispatch safety.
- Collapse direct Takomi subagent launching and board redispatch into one adapter.
- Stop exposing many low-level slash commands as the primary user surface.

## Components

### Shared Core

- `src/pi-takomi-core/types.ts`
  - Add native-compatible dispatch shapes for single, parallel, and chain.
  - Keep Takomi lifecycle metadata on top of those shapes.
  - Add command visibility or entrypoint metadata if Pi supports it cleanly.

- `src/pi-takomi-core/orchestration.ts`
  - Keep Genesis-first lifecycle session creation.
  - Add helpers to convert approved lifecycle plans into native-style subagent task groups.
  - Keep dynamic stage expansion.

- `src/pi-takomi-core/routing.ts`
  - Route broad user requests into plan-first Takomi mode.
  - Route small requests to direct execution.
  - Route approved multi-agent work to the unified subagent adapter.

### Pi Runtime

- `.pi/extensions/takomi-runtime/index.ts`
  - Split before implementation because this file is well past the 200-line modularity target.
  - Keep extension registration here as a thin shell only.
  - Move command registration to a dedicated command module.
  - Move `takomi_board` registration to a board-tool module.
  - Move lifecycle prompt injection to a runtime-injection module.

- `.pi/extensions/takomi-runtime/subagent-controller.ts`
  - Track Pi default single, parallel, and chain runs as first-class run groups.
  - Remain internal state only for status, review continuity, and board synchronization.
  - Do not render Takomi's legacy below-editor or fullscreen subagent UI by default.

- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - Kept only as legacy fallback code while native subagent tool rendering becomes the user-facing surface.

### Unified Subagent Adapter

- `.pi/extensions/takomi-subagents/index.ts`
  - Become the compatibility wrapper around the default Pi subagent semantics.
  - Register only `takomi_subagent`; do not register `subagent`, because the default/user-level subagent extension owns that name.
  - Support `agent/task`, `tasks`, and `chain`.
  - Default to project plus user agent discovery, with project-agent confirmation when needed.
  - Continue to expose Takomi plan preview and `confirmLaunch`.

- `.pi/extensions/takomi-subagents/dispatch.ts`
  - Keep Takomi's model preflight, fallback models, thinking, checklist, workflow, stage, and conversation continuity.
  - Add parallel execution with a safe concurrency limit matching Pi's default behavior.
  - Keep chain `{previous}` substitution.
  - Emit runtime events for each run and for grouped run progress.

- `.pi/extensions/takomi-subagents/agents.ts`
  - Align discovery semantics with Pi default:
    - `user`
    - `project`
    - `both`
  - Keep Takomi extensions: fallback models and thinking.

### Commands

Primary visible commands should be:

- `/takomi`
  - Main entrypoint.
  - Shows the lifecycle command guide when called without arguments.
  - Supports `genesis`, `design`, `build`, `plan`, `mode`, `gate`, and `subagents` subcommands.
  - Keeps noisy low-level commands out of slash autocomplete.

- `/takomi-status`
  - Shows current lifecycle, active session, execution gate, subagent toggle state, and active subagents.

- `/takomi-reset`
  - Resets session-local Takomi state.

Advanced commands can remain registered only if Pi can hide them from default suggestions. If not, prefer removing aliases that are not essential and using tool parameters, shortcuts, or status UI instead.

Implemented command mapping:

- `/takomi genesis [prompt]` replaces `/takomi-genesis`.
- `/takomi design [prompt]` replaces `/takomi-design` and is explicitly UI/UX focused.
- `/takomi build [prompt]` replaces `/takomi-build`.
- `/takomi plan [title]` replaces `/takomi-lifecycle`, `/takomi-kickoff`, `/takomi-plan`, and `/autoorch` as the plan/session entrypoint.
- `/takomi mode <direct|orchestrate|review>` replaces `/orch`, `/architect`, `/code`, and `/review` as separate mode commands.
- `/takomi gate <auto|review>` replaces `/takomi-launch-mode` with user-facing review-gate semantics.
- `/takomi subagents <on|off|status|expand|collapse|toggle>` controls delegation, status, and Pi's native tool-result expansion state for Takomi output.

Commands to collapse or de-emphasize:

- `/takomi-genesis`
- `/takomi-design`
- `/takomi-build`
- `/takomi-lifecycle`
- `/takomi-kickoff`
- `/takomi-plan`
- `/takomi-launch-mode`
- `/takomi-subagent-expand`
- `/takomi-subagent-collapse`
- `/takomi-subagents-minimize`
- `/takomi-subagents-status`
- `/takomi-subagent-toggle`
- `/takomi-subagent-fullscreen`
- `/takomi-subagents-fullscreen`
- `/takomi-subagent-next`
- `/takomi-subagent-prev`
- `/autoorch`
- `/orch`
- `/architect`
- `/code`
- `/review`

Shortcuts can stay for power use:

- Native Pi result controls, `Alt+T`, and `/takomi subagents expand` expand subagent details.
- Legacy Takomi subagent shortcuts now toggle or explain the native result UI instead of opening custom UI.

## Data Flow

1. User enters a request.
2. Takomi routing decides whether the request is direct, plan-only, or orchestration-worthy.
3. If planning is needed, Takomi creates or updates a lifecycle plan and stores artifacts under `docs/tasks/orchestrator-sessions/<sessionId>/` and `.pi/takomi/orchestrator/<sessionId>.json`.
4. User finalizes the plan.
5. Takomi converts approved tasks into a native-style subagent run group:
   - single for one task
   - parallel for independent tasks
   - chain for dependent handoffs
6. The unified adapter builds a `TakomiDelegationPlan`.
7. Manual mode returns the readable plan until `confirmLaunch=true`.
8. Auto mode launches immediately after the plan is already considered approved.
9. Dispatch uses the same execution path for direct subagent calls and board redispatch.
10. Runtime events update the bottom command stack and task artifacts.
11. Review can redispatch fixes to the same `conversationId`.

## Database Schema

No database is involved.

Persistent state remains file-based:

- `docs/tasks/orchestrator-sessions/<sessionId>/`
- `.pi/takomi/orchestrator/<sessionId>.json`
- `.pi/takomi/subagents/<conversationId>.jsonl`
- `.pi/takomi-profile.json`

### Proposed Type Additions

```ts
type TakomiAgentScope = "user" | "project" | "both";

type TakomiSubagentMode = "single" | "parallel" | "chain";

type TakomiSubagentTask = {
  agent: string;
  task: string;
  cwd?: string;
  workflow?: string;
  skills?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  checklist?: TaskChecklistItem[];
};

type TakomiSubagentRunGroup = {
  mode: TakomiSubagentMode;
  agentScope: TakomiAgentScope;
  tasks: TakomiSubagentTask[];
  confirmProjectAgents: boolean;
  launchMode: TakomiLaunchMode;
  sessionId?: string;
};
```

## Implementation Plan

### Phase 1: Blueprint Approval

- [x] Compare Pi default subagent example with current Takomi implementation.
- [x] Create this feature blueprint.
- [x] Get user approval before code changes.

### Phase 2: Refactor Runtime Boundaries

- [x] Move consolidated command registration into `.pi/extensions/takomi-runtime/commands.ts`.
- [x] Move command help/completion/status text into `.pi/extensions/takomi-runtime/command-text.ts`.
- [x] Preserve current runtime behavior while reducing the public command surface.
- [ ] Run TypeScript verification.

### Phase 3: Native-Compatible Subagent Adapter

- [x] Add `agentScope`, `tasks`, and `chain` support to Takomi subagents.
- [x] Add safe parallel execution and chain `{previous}` substitution.
- [x] Keep model preflight, fallback, thinking, checklists, workflow, stage, and conversation continuity.
- [x] Align agent discovery with Pi's user/project/both behavior.
- [x] Prompt before running project-local agents by default.

### Phase 4: Top-Level Takomi Entry

- [x] Make `/takomi` the single lifecycle command.
- [x] Add `/takomi-status`.
- [x] Reduce noisy low-level commands from `/Takomi` suggestions by unregistering standalone aliases.
- [x] Keep nested Tab completion stable so `/takomi subagents sta` completes to `/takomi subagents status` instead of collapsing to `/takomi status`.
- [x] Ensure natural language still triggers lifecycle judgment without requiring the literal command.

### Phase 5: Lifecycle Dispatch

- [x] Convert approved board tasks into single, parallel, or chain run groups.
- [x] Make plan finalization the gate before direct subagent dispatch in review/manual gate mode.
- [x] Keep auto mode available for already-approved broad work.
- [x] Preserve review-and-redispatch to the same conversation.

### Phase 6: Docs and Verification

- [x] Update `.pi/README.md`.
- [x] Update related feature docs with final behavior.
- [x] Run targeted Takomi TypeScript verification.
- [ ] Full `pnpm exec tsc --noEmit` is blocked by pre-existing `.pi/extensions/oauth-router` errors.
- [ ] If this project becomes a Convex project during the pass, run `pnpm convex deploy` before handoff as required by project instructions.

### Phase 7: Native Subagent UI Deprecation

- [x] Stop Takomi's runtime controller from rendering the legacy below-editor subagent stack.
- [x] Stop Takomi's runtime controller from opening the legacy custom fullscreen subagent overlay.
- [x] Add Pi-style `renderCall` and `renderResult` handlers to the subagent tool.
- [x] Keep Pi's default `subagent` tool name unclaimed by Takomi to avoid extension conflicts.
- [x] Register `takomi_subagent` as the Takomi lifecycle-aware wrapper and brand its renderer as Takomi.
- [x] Bridge Takomi runtime events into tool partial updates so live subagent progress remains visible without the legacy panel.
- [x] Map Takomi expand/collapse/toggle controls to Pi's native tool-result expansion state.
- [x] Keep internal run tracking for `/takomi subagents status`, review continuity, and board state sync.
- [x] Map simple `general` agent requests to `orchestrator` when no literal `general` agent exists.

## Implementation Update

- Added `.pi/extensions/takomi-runtime/commands.ts` and `.pi/extensions/takomi-runtime/command-text.ts` so the command surface is modular and autocomplete-friendly.
- Removed standalone runtime command registrations for lifecycle stages, mode aliases, launch mode, auto-orchestration, and subagent view controls.
- Added `/takomi gate review` as the user-facing review gate over the existing manual launch behavior.
- Fixed nested `/takomi` argument completions so Pi receives the full replacement argument for second-level options like `subagents status`, `mode orchestrate`, and `gate review`.
- Added `/takomi subagent ...` as a forgiving singular alias for `/takomi subagents ...`.
- Added a session-local subagent enable/disable toggle; board redispatch now refuses to launch when subagents are disabled.
- Added `.pi/extensions/takomi-subagents/tool-runner.ts` so the subagent tool can support single, parallel, and chain modes without bloating the registration file.
- Added `agentScope` and project-agent confirmation to Takomi subagent execution.
- Added shared core types for native-compatible subagent run groups.
- Added `takomi_board` action `dispatch_tasks` for approved board tasks with `dispatchMode` values of `single`, `parallel`, and `chain`.
- Deprecated Takomi's visible legacy subagent stack and fullscreen overlay; subagent output now renders through the native-style tool result UI.
- Removed Takomi's project-local `subagent` registration so it no longer conflicts with the default/user-level Pi subagent extension.
- Registered `takomi_subagent` as the Takomi lifecycle-aware wrapper and branded its native-style renderer as Takomi.
- Added live partial updates for `takomi_subagent` so model readiness, running output, logs, blocked state, and completion appear in the native-style result card.
- Simplified `.pi/extensions/takomi-subagents/native-render.ts` so direct `takomi_subagent` output follows the default Pi subagent compact/detail pattern more closely instead of using a bespoke Takomi card layout.
- Rewired `Alt+T`, `Alt+Shift+T`, and `/takomi subagents expand|collapse|toggle` to Pi's native tool-result expansion state.
- Added a safe agent alias fallback so `general` resolves to `orchestrator` when the project does not define a `general` agent.
- Targeted verification passed for the changed Takomi runtime, subagent, and shared-core files.
- Full repo verification still fails in the unrelated OAuth router extension because several imports end with `.ts` without `allowImportingTsExtensions`, and `state.ts` has two `number | undefined` assignments.

## Acceptance Criteria

- `/takomi` is the clear top-level lifecycle entrypoint.
- Typing `/Takomi` no longer surfaces a confusing wall of rarely used commands.
- Tab completion preserves parent arguments for nested Takomi commands.
- Takomi and Pi default subagent behavior are represented as one system, not two, without duplicate `subagent` tool registration.
- Single, parallel, and chain subagent execution are supported.
- User/project/both agent discovery is supported.
- Project-local agent confirmation is preserved.
- Takomi delegation plans still support manual preview and auto launch.
- Model preflight, fallback models, thinking levels, workflows, skills, checklists, and conversation IDs still work.
- Board redispatch and direct subagent invocation use the same adapter.
- Genesis -> Design -> Build remains the canonical lifecycle.
- Plan finalization happens before execution for unapproved broad work.
- Active subagent run tracking remains centralized, while visible output is owned by Pi's native-style subagent result UI.
- Active Takomi subagent output streams live through Pi's native-style result UI rather than Takomi's legacy below-editor stack.
- Runtime files are kept modular, with new or changed files staying near the 200-line guideline where practical.
- TypeScript verification passes.

## Regressions To Watch

- Do not lose Takomi's conversation continuity when switching closer to Pi's default subagent model.
- Do not remove lifecycle metadata from task packets.
- Do not create user profile files outside the repo.
- Do not break `.pi/agents/*.md` prompt discovery.
- Do not hard-code personal model choices.
- Do not make auto mode launch unapproved plans.
- Do not make manual mode tedious for small one-shot work.
- Do not let compact UI become raw log output.
- Do not break existing `.pi/takomi/` session file compatibility.

## Open Questions

- Does Pi support hidden or internal commands, or do noisy commands need to be unregistered entirely?
- Public tool ownership is resolved: Pi/default owns `subagent`; Takomi owns `takomi_subagent`.
- Should `/takomi` with no args open status, start a blank lifecycle plan, or prompt for the desired outcome?
- Should default launch mode remain `auto`, or should broad lifecycle work default to manual until the user explicitly approves the plan?
