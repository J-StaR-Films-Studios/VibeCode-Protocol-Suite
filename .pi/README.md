# Pi-local Takomi Prototype

This `.pi/` directory is the first Pi-native Takomi scaffold.

It is intentionally separate from the existing cross-harness assets under `assets/.agent/` and `assets/Takomi-Agents/`.

## Contents

- `extensions/takomi-runtime/` - Pi runtime glue, embedded workflow playbooks, and orchestrator board tools
- `extensions/takomi-subagents/` - Takomi-facing subagent wrapper over Pi-style execution semantics with resumable conversation IDs
- `extensions/takomi-context-manager/` - Progressive context loading, skill manifests, policy packs, model-routing gates, and context diagnostics
- `prompts/` - Pi-native prompt shortcuts
- `agents/` - Pi-native specialist agent definitions, including a design-stage agent

## Why this exists

Pi auto-discovers `.pi/`, so this is the fastest way to test and iterate.

At runtime, Takomi for Pi is intended to be self-contained inside this `.pi/` bundle plus the embedded core under `src/pi-takomi-core/`.
The older assets under `assets/.agent/` and `assets/Takomi-Agents/` are reference or migration material, not runtime dependencies for the Pi-native Takomi experience.

Later, this can become:
- a package under `assets/pi/` or `packages/`
- an npm-distributed Pi package
- a shared core used by a Pi SDK-powered Takomi application

## First-use notes

Inside Pi, use:
- `/reload` after edits
- `/takomi` to show the Takomi command guide and enable Takomi mode guidance
- `/takomi genesis [prompt]` to run the Genesis planning stage from existing markdown/project context
- `/takomi design [prompt]` to run UI/UX design against the agreed project direction
- `/takomi build [prompt]` to implement while cross-checking against approved UI/design artifacts
- `/takomi plan [title]` to create a Genesis-first orchestration session that can expand through Design and Build
- `/takomi mode direct`, `/takomi mode orchestrate`, or `/takomi mode review` to choose the session operating mode
- `/takomi gate auto` to continue approved plans automatically
- `/takomi gate review` to return to the user after each task with results and verification guidance
- `/takomi subagents on` or `/takomi subagents off` to allow or disable delegated subagents
- `/takomi subagents status|expand|collapse|fullscreen|next|prev|toggle` to inspect or reshape the active subagent stack
- `/takomi-status` to show lifecycle, gate, session, and active subagent state
- `/takomi-reset` to reset session-local Takomi runtime state
- `/context-report` to inspect prompt compaction, skill loading, policy gates, model routing corrections, and duplicate extension diagnostics
- `takomi_board` actions now include stage expansion, task updates, multi-task dispatch, and redispatch support for review loops
- The old standalone commands (`/takomi-genesis`, `/takomi-design`, `/takomi-build`, `/takomi-kickoff`, `/autoorch`, `/orch`, `/architect`, `/code`, `/review`, and the `/takomi-subagent*` variants) are folded into `/takomi` subcommands so slash autocomplete stays small.
- prompt shortcuts are suffixed with `-prompt` to avoid collisions with runtime commands, e.g. `/orch-prompt`, `/build-prompt`, `/design-prompt`, `/genesis-prompt`, `/takomi-prompt`, `/prime-prompt`
- a project-local theme is available at `.pi/themes/takomi-noir.json`; select `takomi-noir` in `/settings` to use the Takomi UI palette
- additional workflow prompts are available as direct slash commands:
  - `/vibe-primeAgent`
  - `/vibe-spawnTask`
  - `/vibe-syncDocs`

## Dependency + ownership notes

This is the current ownership model other agents should assume:

- `takomi_board` owns lifecycle/session/task orchestration
- `takomi_subagent` is the preferred Takomi-facing delegation tool
- raw Pi `subagent` may still be available in the environment, but is advanced/internal for Takomi work

Important implementation note:

- `takomi_subagent` currently does **not** call raw `subagent` as a tool-to-tool passthrough
- it is implemented in `.pi/extensions/takomi-subagents/`
- it follows Pi-style execution semantics and Pi-style result rendering more closely now
- it is a wrapper/alignment layer, not yet a literal dependency bridge into the `subagent` tool runtime

Bundled with Takomi now:

- `.pi/extensions/takomi-runtime/`
- `.pi/extensions/takomi-subagents/`
- `.pi/extensions/takomi-context-manager/`
- `.pi/prompts/`
- `.pi/agents/`
- `.pi/themes/`
- `src/pi-takomi-core/`

Not yet guaranteed bundled as package dependencies:

- user/global Pi installation
- user/global raw `subagent` extension
- `pi-subagents` as a direct npm dependency of this package

So when working on packaging, agents should distinguish between:

- Takomi-shipped Pi-native runtime assets
- optional user/global Pi runtime dependencies
- optional raw `subagent` availability in the host environment

## Notable behavior

- The lifecycle explicitly models `Genesis -> Design -> Build`.
- Takomi lifecycle judgment is the default runtime behavior, not something that should require the literal phrase `use Takomi`.
- Project defaults live in `.pi/takomi-profile.json`; optional user overrides can be read from `~/.pi/agent/takomi/profile.json`.
- The runtime reads user profile overrides only. It does not write profile files outside the project.
- Profile defaults can assign agents, model preferences, fallback model lists, thinking levels, and dispatch policies by role or lifecycle stage.
- Profile defaults also include `launchMode`, `foreground`, `background`, and `reviewAfterImplementation`.
- Design stage includes a Gemini-oriented hint for model selection.
- Build is treated as a workflow/stage, not as a separate specialist agent.
- A fresh orchestration session starts with a Genesis foundation task, then expands Design and Build only when the scope justifies it.
- The main execution roles remain things like `orchestrator`, `coder`, `designer`, `architect`, and `reviewer`.
- Agent discovery prefers `project/.pi/agents/`, also supports legacy `project/.agents/`, and falls back to Pi's configured user agent directory so new projects can reuse the global Takomi agent pack without hard-coding `~/.pi` assumptions.
- Orchestrator sessions run in hybrid mode:
  - human-readable docs live under `docs/tasks/orchestrator-sessions/<sessionId>/`
  - machine state lives under `.pi/takomi/orchestrator/<sessionId>.json`
- Task packets can carry `workflow`, `skills`, `preferredModel`, `fallbackModels`, `preferredThinking`, `dispatchPolicy`, `conversationId`, and `checklist` metadata.
- Board redispatch and direct subagent calls now build a `TakomiDelegationPlan` before launch. In auto mode the plan launches immediately; in manual mode the plan is returned for review until `confirmLaunch=true` is supplied.
- The subagent tool supports `conversationId`, so reviewed work can be sent back to the same agent for continuation instead of restarting from scratch.
- The subagent tool supports Pi-style single, parallel `tasks`, and sequential `chain` modes.
- The subagent tool supports `agentScope` values of `user`, `project`, and `both`; project-local agents require confirmation by default.
- The subagent tool also supports per-run `workflow`, `skills`, `model`, `fallbackModels`, `thinking`, and `checklist` overrides.
- Board redispatch and direct `takomi_subagent` calls now share one launch path, so model preflight, thinking, fallback behavior, default prompts, and persisted session files stay aligned.
- Pi's default `subagent` tool remains owned by the user-level/default subagent extension to avoid tool-name conflicts; Takomi uses `takomi_subagent` as the preferred lifecycle-aware interface and renders it with the native Pi-style result surface.
- Treat raw `subagent` usage as advanced/internal. Normal Takomi lifecycle work should go through `takomi_subagent` or `takomi_board`.
- Active Takomi subagent work now streams through the native Pi-style result UI instead of Takomi's older below-editor stack.
- Use Pi's native result expansion, `Alt+T`, or `/takomi subagents expand` to inspect detailed subagent output.
- Takomi still tracks active runs internally for status, review continuity, and board synchronization, but it no longer opens a custom subagent fullscreen overlay.
- `takomi-context-manager` reduces prompt bloat by replacing the always-on skill description dump with a names-only Skill Index plus progressive `skill_manifest`/`skill_load` tools.
- `takomi-context-manager` treats `/takomi routing` as the source of truth for model-routing policy via `.pi/settings.json -> takomi.modelRoutingPolicyFile`.
- `takomi-context-manager` gates `takomi_subagent` when model-routing context has not been loaded, provides the routing policy, and tells the agent to retry.
- `takomi-context-manager` can correct safe wrong-provider model requests, block or pause on policy violations, and ask the user whether to retry with an approved model or stop.
- `takomi-context-manager` detects known duplicate global/project Takomi extension paths in `context_report` to help diagnose tool registration conflicts.
- `takomi_board` can:
  - create a Genesis-first lifecycle session by default
  - expand a lifecycle stage into additional tasks
  - update task status and notes
  - update checklist progress
  - dispatch approved tasks as single, parallel, or chain subagent run groups
  - rewrite JSON machine state
  - regenerate task docs into `pending/`, `in-progress/`, `completed/`, and `blocked/`
  - redispatch a task to the same agent with the same `conversationId`
  - use `review_and_redispatch` for a cleaner review loop
