# Pi-local Takomi Prototype

This `.pi/` directory is the first Pi-native Takomi scaffold.

It is intentionally separate from the existing cross-harness assets under `assets/.agent/` and `assets/Takomi-Agents/`.

## Contents

- `extensions/takomi-runtime/` — Pi runtime glue, embedded workflow playbooks, and orchestrator board tools
- `extensions/takomi-subagents/` — project-local subagent execution with resumable conversation IDs
- `prompts/` — Pi-native prompt shortcuts
- `agents/` — Pi-native specialist agent definitions, including a design-stage agent

## Why this exists

Pi auto-discovers `.pi/`, so this is the fastest way to test and iterate.

Later, this can become:
- a package under `assets/pi/` or `packages/`
- an npm-distributed Pi package
- a shared core used by a Pi SDK-powered Takomi application

## First-use notes

Inside Pi, use:
- `/reload` after edits
- `/takomi` to enable Takomi mode guidance
- `/takomi-genesis`, `/takomi-design`, `/takomi-build` for lifecycle stages
- `/takomi-kickoff <title>` to create a default Genesis → Design → Build orchestrator session
- `takomi_board` actions now include task updates and redispatch support for review loops
- `/orch` to bias toward orchestrator behavior
- `/architect`, `/code`, `/review` for focused roles
- `/autoorch` to toggle lightweight automatic orchestration routing
- `/takomi-plan` to toggle planning bias
- prompt shortcuts are suffixed with `-prompt` to avoid collisions with runtime commands, e.g. `/orch-prompt`, `/build-prompt`, `/design-prompt`, `/genesis-prompt`, `/takomi-prompt`, `/prime-prompt`

## Notable behavior

- The lifecycle now explicitly models **Genesis → Design → Build**.
- Design stage includes a Gemini-oriented hint for model selection.
- **Build is treated as a workflow/stage, not as a separate specialist agent.**
- The main execution roles remain things like `orchestrator`, `coder`, `designer`, `architect`, and `reviewer`.
- Orchestrator sessions now run in **hybrid mode**:
  - human-readable docs live under `docs/tasks/orchestrator-sessions/<sessionId>/`
  - machine state lives under `.pi/takomi/orchestrator/<sessionId>.json`
- Task packets can now carry `workflow`, `skills`, `preferredModel`, `conversationId`, and `checklist` metadata.
- The subagent tool supports `conversationId`, so reviewed work can be sent back to the **same agent** for continuation instead of restarting from scratch.
- The subagent tool also supports per-run `workflow`, `skills`, `model`, and `checklist` overrides.
- `takomi_board` can now:
  - update task status and notes
  - update checklist progress
  - rewrite JSON machine state
  - regenerate task docs into `pending/`, `in-progress/`, `completed/`, and `blocked/`
  - redispatch a task to the same agent with the same `conversationId`
  - use `review_and_redispatch` for a cleaner review loop
