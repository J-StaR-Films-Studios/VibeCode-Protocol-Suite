# Pi Takomi Orchestration Alignment

## Goal

Align the Pi-local Takomi runtime with the actual Takomi orchestration model already described in the repo docs and prompt assets.

The current Pi scaffold works, but it mixes three different concerns in a way that can drift over time:
- `.pi/extensions/takomi-runtime/index.ts` acts as both the Pi adapter and the owner of orchestration policy.
- `src/pi-takomi-core/` already contains shared workflow, routing, and session primitives, but it does not yet own the default kickoff/session template behavior.
- the current `/takomi-kickoff` path hard-codes three starter tasks (`Genesis foundation`, `Design handoff`, `Build orchestration`) inside the extension, which makes the scaffold feel more canonical than it should.

This feature should make the relationship explicit:
- `src/pi-takomi-core/` owns reusable Takomi lifecycle and orchestration rules
- `.pi/extensions/` owns Pi-specific command wiring and tool registration
- the default kickoff session is a reusable template defined in shared core, not an extension-only hard-coded block
- Build remains a lifecycle stage and workflow, not a fake specialist role
- Takomi lifecycle judgment is the default orchestration behavior, even when the user does not explicitly say "use Takomi"
- decomposition implies delegation-first execution: the main agent coordinates while `takomi_subagent` implementer and reviewer runs do the execution work by default

## Problem Statement

Current observed mismatches:
- the docs say Build is a workflow/stage that uses orchestration, delegation, review, and redispatch
- the default behavior must make delegation the normal execution path once a request has been decomposed, without over-orchestrating one-shot work
- the runtime implementation creates a fixed three-task orchestrator session in the extension itself
- the shared core has `createTask`, routing, workflow definitions, and session rendering, but not the kickoff template factory
- this makes it harder to keep Pi runtime behavior, docs, and future packaged reuse aligned
- the current kickoff board pre-commits to exactly three top-level tasks, while the intended Takomi behavior is stage-aware and elastic
- the current routing only partially captures the desired default intelligence:
  - broad work should feel Takomi-native automatically
  - smaller work should still be handled directly when orchestration is unnecessary
  - follow-up requests in an existing project should be able to trigger either a one-shot action or a fresh orchestration session based on scope

## Components

### Client / Runtime
- `.pi/extensions/takomi-runtime/index.ts`
  - Pi command registration
  - Pi tool registration
  - runtime state injection into the current Pi session
- `.pi/extensions/takomi-subagents/index.ts`
  - Pi subagent dispatch and conversation continuity
- `.pi/prompts/*.md`
  - user-facing prompt entrypoints that should stay aligned with lifecycle behavior

### Shared Core
- `src/pi-takomi-core/workflows.ts`
  - canonical lifecycle workflow definitions
- `src/pi-takomi-core/routing.ts`
  - route decisions based on stage/role signals
- `src/pi-takomi-core/orchestration.ts`
  - task/session creation, rendering, and persistence helpers
- `src/pi-takomi-core/types.ts`
  - shared shape for tasks, sessions, workflows, and routing

### Storage
- human-readable board files in `docs/tasks/orchestrator-sessions/<sessionId>/`
- machine state in `.pi/takomi/orchestrator/<sessionId>.json`
- subagent continuity logs in `.pi/takomi/subagents/`

## Proposed Changes

1. Make Takomi lifecycle routing the default orchestration bias for Pi-local Takomi runtime, without requiring the user to literally say "use Takomi".
2. Move orchestration-session template logic into `src/pi-takomi-core/`.
3. Replace the current fixed three-task kickoff with a lifecycle-aware starter session model:
   - initial session starts with a single Genesis task
   - that Genesis task is responsible for producing or updating the required planning docs and deciding whether to split
   - Design begins as one stage-level task and may remain one task or split into multiple tasks depending on scope
   - Build begins as one MUS-oriented stage in the lifecycle, then fans out into a reasonable number of implementation tasks based on feature scope
4. Keep Genesis, Design, and Build as the canonical lifecycle backbone, but do not force them to stay one-task-per-stage.
5. Add shared core helpers that support dynamic stage expansion:
   - create initial lifecycle session
   - expand a stage into child tasks when scope justifies it
   - preserve session continuity and review loops when a stage splits
6. Update the Pi runtime extension to call shared core helpers instead of owning orchestration policy inline.
7. Centralize any task packet defaults that belong to Takomi policy in shared core so future Pi packaging or reuse cannot drift.
8. Make the implement-review loop explicit for decomposed work:
   - implementer `takomi_subagent` executes the task
   - reviewer `takomi_subagent` reviews the result
   - the main orchestrator synthesizes, updates the board, and accepts or redispatches
9. Improve route/orchestration decision logic so follow-up requests can choose intelligently between:
   - direct one-shot handling
   - updating the current session
   - creating a new orchestration session for a larger multi-part task
10. Review prompt/docs wording so the scaffold clearly says:
   - a session embodies the full Genesis → Design → Build lifecycle
   - stages may split into multiple tasks or remain compact
   - Build is a stage that often expands into specialist implementation tasks for the MUS
   - orchestration is used by judgment, not by rigid command ritual
   - explicit user overrides such as "do it yourself", "no subagents", or "no new threads" allow direct execution

## Data Flow

1. User creates a session explicitly, or makes a broad enough request that Takomi judgment decides orchestration is appropriate.
2. Pi runtime delegates route/session decisions to `src/pi-takomi-core`.
3. Shared core decides:
   - one-shot execution
   - update existing session
   - create new orchestration session
4. If a new session is needed, shared core creates an initial lifecycle session with Genesis as the first active task.
5. As stage outputs become clearer, the orchestrator can expand Design and Build into more granular tasks.
6. For decomposed implementation work, Pi dispatches an implementer `takomi_subagent`, then a reviewer `takomi_subagent`.
7. The main orchestrator synthesizes results, updates the board, and accepts or redispatches with the same durable task packet.
8. Pi runtime persists:
   - docs task files
   - machine JSON state
   - active runtime state
9. Later board actions update task status, notes, checklist progress, redispatch metadata, stage expansion, and subagent continuity.

## Database Schema

No database is involved today.

Persistent state is file-based:

### Session JSON
- `sessionId: string`
- `title: string`
- `createdAt: string`
- `updatedAt: string`
- `mode: "hybrid"`
- `lifecycle: { genesis: StageState, design: StageState, build: StageState }`
- `sessionIntent?: "full-project" | "feature-scope" | "follow-up-task"`
- `tasks: OrchestratorTask[]`

### StageState
- `status: pending | in-progress | completed | blocked`
- `taskIds: string[]`
- `canExpand?: boolean`
- `expandedAt?: string`
- `notes?: string`

### Task Shape
- `id: string`
- `title: string`
- `role: TakomiRole`
- `status: pending | in-progress | completed | blocked`
- `workflow?: TakomiWorkflowId`
- `preferredAgent?: string`
- `conversationId?: string`
- `preferredModel?: string`
- `preferredModelHint?: string`
- `skills?: string[]`
- `checklist?: { text: string; done?: boolean }[]`
- `objective?: string`
- `scope?: string[]`
- `definitionOfDone?: string[]`
- `expectedArtifacts?: string[]`
- `dependencies?: string[]`
- `reviewCheckpoint?: string`
- `instructions?: string[]`
- `notes?: string`

## Regression Risks

- existing Pi users may already rely on `/takomi-kickoff` creating exactly these three tasks
- prompt/docs wording may still imply the scaffold template is the canonical Takomi flow
- moving policy into shared core must not break current session file layout or redispatch behavior
- smarter automatic routing can become annoying if thresholds are too eager and trigger orchestration for normal small tasks
- delegation-first language can be misread as mandatory ceremony; direct execution must remain valid for small one-shot tasks and explicit user opt-outs
- dynamic stage expansion can become confusing if the board does not make parent-stage versus child-task relationships obvious

## Acceptance Criteria

- shared core owns the default orchestration-session template and lifecycle expansion helpers
- Pi runtime no longer hard-codes the starter task array inline
- Takomi lifecycle judgment can be applied by default without requiring the literal phrase "use Takomi"
- a new orchestration session starts with a Genesis-first lifecycle backbone instead of a rigid fixed task list
- Genesis, Design, and Build can each remain compact or expand into multiple tasks based on scope
- Build can represent MUS implementation across many tasks without breaking the lifecycle model
- decomposed Pi orchestration uses `takomi_subagent` implementer and reviewer passes by default
- the main orchestrator remains responsible for synthesis, board updates, acceptance, redispatch, and final user handoff
- explicit user overrides allow direct execution
- follow-up requests can be judged as one-shot work or orchestration-worthy work using explicit shared-core logic
- existing session file format remains compatible
- docs reflect that lifecycle stages are canonical, while task count is dynamic
- runtime behavior still supports workflow, skills, preferred model, checklist, and `conversationId` continuity

## Open Questions

- whether stage expansion should be represented purely as more tasks or as explicit parent/child task metadata
- whether an existing active session should be auto-reused for related follow-up work by default, or only when the user references it
- what thresholds should determine one-shot versus orchestration-worthy follow-up work
- whether more runtime persistence helpers should also move from the extension into shared core in this same pass
