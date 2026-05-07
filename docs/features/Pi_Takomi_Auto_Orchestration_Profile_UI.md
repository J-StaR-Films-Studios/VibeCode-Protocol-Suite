# Pi Takomi Auto Orchestration Profile UI

## Goal

Make Pi-local Takomi feel automatic and deliberate during multi-step work.

The runtime should:
- apply Takomi orchestration judgment without requiring the user to repeatedly say "use subagents"
- keep the Takomi lifecycle board as the durable source of work
- align delegated runs with Pi-native subagent concepts such as model, fallback models, thinking level, default prompts, and persisted sessions
- show active subagents as a compact readable stack instead of raw tool noise

## Components

### Shared Core
- `src/pi-takomi-core/types.ts`
  - add `TakomiThinkingLevel`
  - add task-level model/thinking dispatch fields
  - add profile types for role, stage, and review defaults
- `src/pi-takomi-core/orchestration.ts`
  - preserve model/thinking dispatch metadata when creating and rendering tasks

### Pi Runtime
- `.pi/extensions/takomi-runtime/index.ts`
  - make smart auto-orchestration the default
  - apply profile defaults when materializing board tasks
  - use a shared dispatch adapter for board redispatch and review redispatch
- `.pi/extensions/takomi-runtime/subagent-types.ts`
  - carry thinking level and fallback model metadata into the live view model
- `.pi/extensions/takomi-runtime/subagent-render.ts`
  - show agent, task, model, thinking, duration, checklist progress, and summary in compact cards
  - keep raw tool activity secondary unless fullscreen detail is open

### Pi Subagents
- `.pi/extensions/takomi-subagents/agents.ts`
  - read optional `thinking` and fallback model frontmatter from agent files
- `.pi/extensions/takomi-subagents/dispatch.ts`
  - own shared subagent launch behavior
  - use agent default prompt, model defaults, fallback models, thinking, JSON streaming, and persisted `conversationId` session files
- `.pi/extensions/takomi-subagents/index.ts`
  - keep the public `takomi_subagent` tool while delegating execution to the shared adapter

### Profile
- `.pi/takomi-profile.json`
  - project-level defaults shipped with neutral values
- optional user override path:
  - `~/.pi/agent/takomi/profile.json`
  - read only; the runtime must not write outside the repo

## Data Flow

1. User enters a request.
2. Runtime route logic decides whether the request is direct or orchestration-worthy.
3. For broad/multi-step work, runtime biases the turn toward Takomi orchestrator mode and instructs the agent to create or expand a board and dispatch specialists.
4. Generated board tasks receive profile defaults for agent, model, fallback models, and thinking level.
5. Redispatch and direct `takomi_subagent` calls both use the same dispatch adapter.
6. The adapter resolves model availability, passes `--thinking` when selected, writes a temporary system prompt from the agent default prompt, and uses a stable session file for continuation.
7. Runtime events update the single shared subagent controller.
8. The subagent UI renders a compact active stack and reserves detailed raw activity for fullscreen.

## Database Schema

No database is involved.

Persistent file state:
- project profile: `.pi/takomi-profile.json`
- optional user profile override: `~/.pi/agent/takomi/profile.json`
- board docs: `docs/tasks/orchestrator-sessions/<sessionId>/`
- board JSON: `.pi/takomi/orchestrator/<sessionId>.json`
- subagent sessions: `.pi/takomi/subagents/<conversationId>.jsonl`

### Profile Shape

- `version: 1`
- `autoOrchestrate: boolean`
- `roles: Record<TakomiRole, DispatchDefaults>`
- `stages: Record<VibeLifecycleStage, DispatchDefaults>`
- `review: { enabled: boolean; agent?: string; maxIterations?: number; sameConversation: boolean }`

### DispatchDefaults

- `agent?: string`
- `model?: string`
- `fallbackModels?: string[]`
- `thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"`
- `dispatchPolicy?: "direct" | "subagent" | "review-first"`

### Task Additions

- `preferredThinking?: TakomiThinkingLevel`
- `fallbackModels?: string[]`
- `dispatchPolicy?: "direct" | "subagent" | "review-first"`

## Regression Risks

- Automatic orchestration can feel too eager if route thresholds are too broad.
- Per-task thinking values must not be sent when unset, so existing users keep Pi's current session behavior by default.
- Model fallback resolution must remain visible and must not silently choose an unexpected provider.
- UI compaction must not hide failures or blocked tasks.
- The shared dispatch adapter must preserve `conversationId` behavior so review redispatch continues in the same session.

## Acceptance Criteria

- [x] Feature doc exists before code changes.
- [x] Smart auto-orchestration is enabled by default but remains configurable.
- [x] Takomi profile defaults can be read from project config and optional user override.
- [x] Generated tasks preserve preferred model, fallback models, thinking, and dispatch policy.
- [x] Board redispatch and direct `takomi_subagent` use one shared launch adapter.
- [x] Subagent launches pass model and thinking deliberately when configured.
- [x] Stable `conversationId` continues to map to persisted subagent sessions.
- [x] Compact/expanded UI shows active agent identity, model, thinking, checklist progress, and summary.
- [x] Raw tool noise is visually secondary outside fullscreen.
- [ ] `pnpm exec tsc --noEmit` passes.

## Context Notes

- `docs/project_requirements.md` and `docs/Project_Requirements.md` are currently missing, so this feature is grounded in the existing Pi/Takomi feature docs instead.
- This pass follows the hybrid-native path: Takomi keeps lifecycle board ownership while adopting Pi-native subagent semantics where they fit.

## Implementation Notes

- Added `.pi/takomi-profile.json` with neutral agent/dispatch defaults and no forced personal model choices.
- Added `.pi/extensions/takomi-runtime/profile.ts` to merge project defaults with a read-only user override.
- Added `.pi/extensions/takomi-subagents/dispatch.ts` so board redispatch and direct `takomi_subagent` calls share model preflight, fallback, thinking, prompt, and session behavior.
- Direct subagent execution now accepts `fallbackModels` and `thinking`.
- Board tasks now preserve `preferredThinking`, `fallbackModels`, and `dispatchPolicy` in docs and JSON.
- Scoped Takomi type check passes; the full repo check is still blocked by existing OAuth router TypeScript errors unrelated to this feature.
