# Pi-local Takomi Prototype

This `.pi/` directory is the first Pi-native Takomi scaffold.

It is intentionally separate from the existing cross-harness assets under `assets/.agent/` and `assets/Takomi-Agents/`.

## Contents

- `extensions/takomi-runtime/` - Pi runtime glue, embedded workflow playbooks, and orchestrator board tools
- `extensions/takomi-subagents/` - project-local subagent execution with resumable conversation IDs
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
- `/takomi` to enable Takomi mode guidance
- `/takomi-genesis`, `/takomi-design`, `/takomi-build` for lifecycle stages
- `/takomi-kickoff <title>` to create a Genesis-first orchestration session that can expand through Design and Build
- `takomi_board` actions now include stage expansion, task updates, and redispatch support for review loops
- `/orch` to bias toward orchestrator behavior
- `/architect`, `/code`, `/review` for focused roles
- `/autoorch` to toggle lightweight automatic orchestration routing, which is enabled by default for broad or multi-step work
- `/takomi-plan` to toggle planning bias
- prompt shortcuts are suffixed with `-prompt` to avoid collisions with runtime commands, e.g. `/orch-prompt`, `/build-prompt`, `/design-prompt`, `/genesis-prompt`, `/takomi-prompt`, `/prime-prompt`
- a project-local theme is available at `.pi/themes/takomi-noir.json`; select `takomi-noir` in `/settings` to use the Takomi UI palette
- additional workflow prompts are available as direct slash commands:
  - `/vibe-primeAgent`
  - `/vibe-spawnTask`
  - `/vibe-syncDocs`

## Notable behavior

- The lifecycle explicitly models `Genesis -> Design -> Build`.
- Takomi lifecycle judgment is the default runtime behavior, not something that should require the literal phrase `use Takomi`.
- Project defaults live in `.pi/takomi-profile.json`; optional user overrides can be read from `~/.pi/agent/takomi/profile.json`.
- The runtime reads user profile overrides only. It does not write profile files outside the project.
- Profile defaults can assign agents, model preferences, fallback model lists, thinking levels, and dispatch policies by role or lifecycle stage.
- Design stage includes a Gemini-oriented hint for model selection.
- Build is treated as a workflow/stage, not as a separate specialist agent.
- A fresh orchestration session starts with a Genesis foundation task, then expands Design and Build only when the scope justifies it.
- The main execution roles remain things like `orchestrator`, `coder`, `designer`, `architect`, and `reviewer`.
- Agent discovery prefers `project/.pi/agents/` and falls back to `~/.pi/agent/agents/` so new projects can reuse the global Takomi agent pack without manual copying.
- Orchestrator sessions run in hybrid mode:
  - human-readable docs live under `docs/tasks/orchestrator-sessions/<sessionId>/`
  - machine state lives under `.pi/takomi/orchestrator/<sessionId>.json`
- Task packets can carry `workflow`, `skills`, `preferredModel`, `fallbackModels`, `preferredThinking`, `dispatchPolicy`, `conversationId`, and `checklist` metadata.
- The subagent tool supports `conversationId`, so reviewed work can be sent back to the same agent for continuation instead of restarting from scratch.
- The subagent tool also supports per-run `workflow`, `skills`, `model`, `fallbackModels`, `thinking`, and `checklist` overrides.
- Board redispatch and direct `takomi_subagent` calls now share one launch path, so model preflight, thinking, fallback behavior, default prompts, and persisted session files stay aligned.
- Active subagent work now stays anchored below the editor so it remains visible near the input/footer while transcript history scrolls independently.
- The active subagent stack shows agent identity, model, thinking level, duration, checklist progress, and a meaningful summary line while keeping raw tool activity secondary outside fullscreen.
- `Alt+T` cycles the live Takomi surface through compact stack, bounded expanded stack, and fullscreen detail.
- The expanded below-editor widget is intentionally short so Pi does not truncate it into an unusable wall of text.
- Fullscreen is the detailed reading mode and supports `Up`/`Down`, `PgUp`/`PgDn`, `Home`, `End`, `j`, and `k` for scrolling.
- `takomi_board` can:
  - create a Genesis-first lifecycle session by default
  - expand a lifecycle stage into additional tasks
  - update task status and notes
  - update checklist progress
  - rewrite JSON machine state
  - regenerate task docs into `pending/`, `in-progress/`, `completed/`, and `blocked/`
  - redispatch a task to the same agent with the same `conversationId`
  - use `review_and_redispatch` for a cleaner review loop
