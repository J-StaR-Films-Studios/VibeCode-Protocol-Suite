# Pi Takomi Harness Independence

## Goal

Make the Pi-local Takomi harness perform like Takomi by default, even when the user has not installed or explicitly invoked the external `takomi` skill.

The harness should ship its own strong Genesis, orchestration, design, and build behavior. The optional skill remains valuable as a portable packaging of the same philosophy, but it must not be a hidden quality dependency.

## Problem Statement

Current behavior appears to split Takomi intelligence across too many layers:

- shipped prompts in `.pi/prompts/`
- runtime orchestration logic in `.pi/extensions/takomi-runtime/`
- shared lifecycle helpers in `src/pi-takomi-core/`
- optional skill guidance outside the harness

That split becomes a problem when the best results only happen after the agent loads the external skill. In that state, the harness is not truly independent; it is only partially self-contained.

The target behavior is:

- the harness works well without the external skill
- prompts and policy packs already encode the "strong architect" behavior
- markdown docs are authored directly by the model
- JSON remains a tracking and linking layer, not the primary authoring format

## Components

### Prompt Layer

- `.pi/prompts/takomi-prompt.md`
  - always-on Takomi operating mindset
- `.pi/prompts/genesis-prompt.md`
  - project foundation and artifact generation rules
- `.pi/prompts/orch-prompt.md`
  - orchestration-session behavior and decomposition rules
- `.pi/prompts/build-prompt.md`
  - implementation-phase execution rules
- `.pi/prompts/prime-prompt.md`
  - context priming and skill-loading guidance

### Runtime Layer

- `.pi/extensions/takomi-runtime/index.ts`
  - runtime state, session creation, board actions, and prompt injection
- `.pi/extensions/takomi-context-manager/prompt-rewriter.ts`
  - candidate context display and prompt shaping
- `.pi/extensions/takomi-context-manager/policy-registry.ts`
  - lazy policy-pack discovery and loading

### Shared Core

- `src/pi-takomi-core/routing.ts`
  - route decisions and orchestration-worthiness detection
- `src/pi-takomi-core/workflows.ts`
  - canonical workflow definitions and lifecycle expectations
- `src/pi-takomi-core/orchestration.ts`
  - session creation, task rendering, lifecycle derivation, and persistence shape
- `src/pi-takomi-core/types.ts`
  - shared contract for tasks, sessions, routing, and workflow identity

### Persistent Artifacts

- `docs/project_requirements.md`
  - product-level requirements source of truth
- `docs/features/`
  - feature-level design and planning docs
- `docs/tasks/orchestrator-sessions/<sessionId>/`
  - human-readable orchestration plans and task packets
- `.pi/takomi/orchestrator/<sessionId>.json`
  - machine-readable session state used for tracking and redispatch

## Proposed Changes

1. Treat the harness prompts as the primary carrier of Takomi behavior.
2. Make external skill loading optional enrichment, not a prerequisite for high-quality Genesis or orchestration output.
3. Move any remaining "secret sauce" behavior from skill-only phrasing into shipped prompts, shared workflows, or shared-core policy helpers.
4. Keep markdown deliverables as the model's authored output:
   - PRD
   - feature docs
   - builder prompts
   - coding guidelines
   - orchestration session docs
5. Make orchestration markdown use a concise architect-style format:
   - readable overview first
   - clear context intake
   - compact skills and workflow registries
   - actionable task packets with minimal bookkeeping noise
6. Use JSON only for:
   - session metadata
   - task metadata
   - lifecycle stage state
   - dispatch continuity
   - links to authored docs
7. Keep conversation IDs, model overrides, dispatch policy, and similar runtime details in JSON unless they are directly useful to a human reader.
8. Add validation that checks session completeness and document quality without forcing authorship through rigid JSON templates first.
9. Ensure Genesis and orchestration prompts explicitly require:
   - strong documentation authorship
   - decomposition when the project is broad
   - clear next-stage recommendations
   - a distinction between authoring layer and bookkeeping layer

## Data Flow

1. The user makes a request.
2. `src/pi-takomi-core/routing.ts` determines whether the request should be handled directly or through Takomi orchestration.
3. The runtime injects the appropriate shipped prompt behavior from `.pi/prompts/`.
4. Optional skill or policy packs may be loaded if they are relevant, but the base harness is already sufficient.
5. The model writes markdown artifacts directly.
6. The harness extracts or mirrors only the tracking metadata needed for:
   - session state
   - lifecycle status
   - task linkage
   - redispatch continuity
7. The runtime stores:
   - human-readable docs in `docs/tasks/orchestrator-sessions/<sessionId>/`
   - machine-readable state in `.pi/takomi/orchestrator/<sessionId>.json`
8. A validator or repair pass checks for completeness, missing artifacts, shallow decomposition, and doc-structure problems.

## Database Schema

No database is involved.

Persistent state remains file-based.

### Session JSON

- `sessionId: string`
- `title: string`
- `createdAt: string`
- `updatedAt: string`
- `mode: "hybrid"`
- `sessionIntent: "full-project" | "feature-scope" | "follow-up-task"`
- `lifecycle: { genesis, design, build }`
- `tasks: OrchestratorTask[]`

### Lifecycle Stage State

- `status: "pending" | "in-progress" | "completed" | "blocked"`
- `taskIds: string[]`
- `canExpand?: boolean`
- `expandedAt?: string`
- `notes?: string`

### Orchestrator Task

- `id: string`
- `title: string`
- `role: TakomiRole`
- `stage: "genesis" | "design" | "build"`
- `status: "pending" | "in-progress" | "completed" | "blocked"`
- `workflow?: TakomiWorkflowId`
- `preferredAgent?: string`
- `conversationId?: string`
- `preferredModel?: string`
- `preferredThinking?: string`
- `dispatchPolicy?: string`
- `skills?: string[]`
- `objective?: string`
- `scope?: string[]`
- `definitionOfDone?: string[]`
- `expectedArtifacts?: string[]`
- `dependencies?: string[]`
- `reviewCheckpoint?: string`
- `instructions?: string[]`
- `notes?: string`

## Risks / Regressions

- stronger default prompts can become too verbose if they absorb skill text without pruning
- duplicated policy between prompts and skills can drift unless one canonical source is identified
- the runtime may still silently depend on optional context-loading behavior in edge cases
- validators can become too rigid if they police structure instead of usefulness
- JSON extraction can accidentally become a second authoring pipeline if it tries to reconstruct prose instead of only tracking metadata

## Acceptance Criteria

- the harness produces high-quality Genesis and orchestration output without requiring the external `takomi` skill
- shipped prompts clearly embody Takomi lifecycle behavior
- markdown remains the primary authored output layer
- JSON remains a tracking and continuity layer
- orchestration sessions create both human docs and machine state consistently
- broad projects decompose into meaningful tasks instead of a single vague placeholder
- validators check completeness and quality without forcing JSON-first authorship

## Open Questions

- which exact prompt language from the external skill should move into shipped prompts versus shared workflows
- whether validation should run as a dedicated post-pass tool, a runtime hook, or both
- whether authored markdown should be parsed into structured metadata automatically or only when the runtime truly needs it
- how much policy text belongs in `.pi/prompts/` versus lazy-loaded policy packs
