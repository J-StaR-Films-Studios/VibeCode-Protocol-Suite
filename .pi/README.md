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
- `/orch` to bias toward orchestrator behavior
- `/architect`, `/code`, `/review` for focused roles
- `/autoorch` to toggle lightweight automatic orchestration routing
- `/takomi-plan` to toggle planning bias

## Notable behavior

- The lifecycle now explicitly models **Genesis → Design → Build**.
- Design stage includes a Gemini-oriented hint for model selection.
- Build stage is treated as an orchestrated loop.
- The subagent tool supports `conversationId`, so reviewed work can be sent back to the **same agent** for continuation instead of restarting from scratch.
