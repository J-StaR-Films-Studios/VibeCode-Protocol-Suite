---
name: takomi-codex
description: Use Takomi lifecycle orchestration inside Codex with policy-aware runtime detection, markdown roadbooks, optional Pi/Takomi dispatch, and optional multi-Codex-thread delegation.
---

# Takomi Codex

Takomi Codex is the Codex-native adapter for the Takomi protocol. Use it when the user asks for Takomi, orchestration, roadbooks, Genesis/Design/Build lifecycle work, policy-aware execution, Pi/Takomi runtime inspection, or multi-thread task coordination.

## Operating Principle

Choose the smallest execution mode that can do the work well:

1. Direct Codex work for small, local tasks.
2. Planning mode for unclear or design-heavy work.
3. Markdown roadbook orchestration for broad multi-step work.
4. Pi/Takomi bridge only when local runtime state exists and the user or policy makes it useful.
5. Multi-Codex-thread delegation only when thread tools are available and independent specialist work is worth the coordination cost.

Do not create a board, launch a harness, or spawn threads for trivial edits.

## Required Context Pass

Before complex code or orchestration, inspect the project:

- `docs/features/`
- `docs/project_requirements.md`
- `docs/Project_Requirements.md`
- local `.pi/` if relevant
- Takomi feature docs related to the request

For major features, create or update a feature markdown file before implementation.

## Runtime Detection

Use `scripts/takomi-detect.ps1` when runtime state affects the answer.

Detection priority:

1. Project-local `.pi/`.
2. User/global `~/.pi/agent/` and `~/.agents/skills/`.
3. CLI availability for `takomi` and `pi`.
4. Plugin-bundled guidance.

Global/user paths are read-only unless the user explicitly approves a write.

## Policy Loading

Use `scripts/takomi-policy.ps1` when model, subagent, review, or lifecycle routing matters.

Respect project policy first:

- `.pi/settings.json`
- `.pi/takomi-profile.json`
- `.pi/takomi/model-routing.md`
- `.pi/takomi/policies/`

Avoid hard-coding personal model names as universal defaults. Prefer provider-qualified model IDs only when the active policy or runtime registry supports them.

## Roadbook Orchestration

Use `scripts/takomi-board.ps1` for broad work that needs durable coordination.

Roadbooks live at:

```text
docs/tasks/orchestrator-sessions/<sessionId>/
```

The markdown layer is primary:

- `master_plan.md`
- `pending/*.task.md`
- `in-progress/*.task.md`
- `completed/*.task.md`
- `blocked/*.task.md`
- `Orchestrator_Summary.md`

JSON tracking is optional and should not replace readable markdown.

## Lifecycle Modes

### Genesis

Use for project foundations, requirements, feature planning, and issue-style task breakdowns.

Expected artifacts:

- PRD or project requirements update
- feature docs
- task/issue docs
- acceptance criteria

### Design

Use for UX, architecture shape, interface contracts, and build-ready direction.

Expected artifacts:

- design notes or specs
- component/interface plan
- risks and constraints

### Build

Use for implementation after enough context exists.

Expected behavior:

- implement iteratively
- keep files focused
- update docs alongside code
- verify with available tests or scripts

### Review

Use for bug finding, quality gates, security review, and completion audits.

Expected behavior:

- lead with findings
- verify artifacts before marking complete
- record unresolved risks

## Pi/Takomi Bridge

Use `scripts/takomi-pi-dispatch.ps1` conservatively.

Default behavior is dry-run recommendation. Only run real Pi/Takomi commands when:

- the user explicitly asks for it, or
- an active policy calls for it and the action is safe, or
- the command is diagnostic/read-only.

Do not assume raw subagent tools are present. Prefer Takomi-facing surfaces when available.

## Other Harnesses

Use `scripts/takomi-harness.ps1` when a project policy or user request points to other Takomi-supported harnesses.

Default behavior is dry-run. Before running with `-Execute`:

- confirm the target harness or Takomi command
- understand whether it will write user/global files
- prefer `status` or `harnesses` before `sync`, `setup`, or `refresh`
- keep Codex as the parent coordinator unless the user explicitly hands off execution

## Multi-Codex-Thread Delegation

When the user asks for parallel orchestration or a task is broad enough to justify delegation:

1. Search for Codex thread tools with `tool_search`.
2. Create child threads only when `create_thread` or equivalent tools are actually available.
3. Give each child thread a self-contained task packet path and definition of done.
4. Keep the parent thread responsible for synthesis, verification, docs, and board updates.
5. Do not send child threads tasks that require global/user config writes unless the user approved that scope.

If thread tools are unavailable, fall back to markdown task packets and direct Codex execution.

## File Size Discipline

Keep plugin scripts and skill files modular. If a file approaches 200 lines, split responsibilities instead of growing one giant file.

## Completion Rule

Before handoff:

- update the relevant feature doc
- update the roadbook if one exists
- run the plugin validator when plugin files changed
- run script smoke checks when scripts changed
- state what was verified and what remains unverified
