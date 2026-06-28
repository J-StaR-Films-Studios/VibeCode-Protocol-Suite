# Codex Takomi Plugin

## Goal

Create a repo-committable Codex plugin that embodies Takomi as a portable orchestration layer while adapting to local Pi/Takomi runtime state when it exists.

The plugin should let a normal Codex request use Takomi judgment without forcing ceremony:

- small tasks stay direct
- broad tasks create or update markdown roadbooks
- policy-aware tasks inspect project/user Takomi config
- available Pi/Takomi runtimes can be used through explicit scripts or future MCP tools
- multi-Codex-thread orchestration is supported as an execution strategy when thread tools are available

## Components

### Codex Plugin

- `plugins/takomi-codex/.codex-plugin/plugin.json`
  - valid Codex plugin manifest
  - points to bundled skills and scripts
  - points to bundled logo/icon assets
  - avoids unsupported fields
- `.agents/plugins/marketplace.json`
  - repo-local marketplace metadata
  - points Codex at `./plugins/takomi-codex`
- `plugins/takomi-codex/skills/takomi-codex/SKILL.md`
  - Codex-native Takomi entrypoint
  - lifecycle routing for Genesis, Design, Build, Review, and Recovery
  - environment adapter rules for Pi/Takomi detection
  - markdown-board orchestration rules
  - optional multi-Codex-thread orchestration rules
- `plugins/takomi-codex/scripts/`
  - `takomi-detect.ps1`
  - `takomi-doctor.ps1`
  - `takomi-board.ps1`
  - `takomi-policy.ps1`
  - `takomi-pi-dispatch.ps1`
  - `takomi-harness.ps1`

### Client / Agent Surface

- Codex loads the plugin skill and applies Takomi routing.
- The agent can call local scripts through the terminal.
- The agent can use Codex thread tools if available and explicitly useful.
- The agent reports which mode it selected for broad work.

### Server / Runtime Surface

There is no long-running server in the first pass.

The plugin reads file-system state and may call local commands:

- project `.pi/`
- `~/.pi/agent/`
- `~/.agents/skills/`
- `takomi` CLI
- `pi` CLI
- project `docs/tasks/orchestrator-sessions/`

Future versions can add an MCP server once the script contract settles.

## Data Flow

1. User asks Codex for work.
2. The `takomi-codex` skill classifies the request:
   - direct task
   - planning task
   - lifecycle task
   - orchestration task
   - review/recovery task
3. The skill loads only relevant context:
   - project requirements
   - feature docs
   - Takomi policies
   - available runtime profile
4. The agent runs detection scripts when runtime state matters.
5. For broad work, the agent creates or updates markdown roadbooks:
   - `docs/tasks/orchestrator-sessions/<sessionId>/master_plan.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/pending/*.task.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/in-progress/*.task.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/completed/*.task.md`
   - `docs/tasks/orchestrator-sessions/<sessionId>/blocked/*.task.md`
6. Execution uses the smallest sufficient path:
   - Codex direct work
   - local scripts
   - Pi/Takomi CLI bridge when available
   - multi-Codex-thread delegation when tools are available and the task warrants it
7. The agent updates docs and board state before handoff.

## Database Schema

No database is required.

Persistent state is file-based.

### Plugin Manifest

- `.codex-plugin/plugin.json`
  - plugin identity
  - semver
  - skills path
  - interface metadata

### Roadbook Markdown

- `sessionId`
- goal
- context intake
- policies consulted
- execution mode
- task table
- task packet files
- verification notes
- completion summary

### Optional Machine State

The first pass should not require JSON state. If needed later, add:

- `.takomi-codex/sessions/<sessionId>.json`

Only use JSON for machine continuity; markdown remains the source of human trust.

## Runtime Detection Priority

1. Project-local Takomi/Pi config:
   - `.pi/settings.json`
   - `.pi/takomi-profile.json`
   - `.pi/takomi/model-routing.md`
   - `.pi/takomi/policies/`
   - `.pi/agents/`
   - `.pi/prompts/`
2. User/global config:
   - `~/.pi/agent/`
   - `~/.agents/skills/`
3. CLI availability:
   - `takomi`
   - `pi`
4. Plugin-bundled defaults.

## Write Policy

- Project files can be created or changed when the user requested project work.
- User/global files must not be written without explicit user confirmation.
- The plugin should prefer read-only detection for global paths.
- Roadbook markdown is project-owned and safe to commit.
- Plugin package files live under `plugins/takomi-codex/` so this repo can commit them.

## Commands

### `takomi-detect.ps1`

Reports available runtime surfaces:

- project root
- `.pi` presence
- Takomi profile
- routing policy
- local/global agents
- `takomi` CLI path/version
- `pi` CLI path/version
- Codex plugin root

### `takomi-doctor.ps1`

Runs deeper checks and returns human-readable remediation:

- missing plugin files
- invalid plugin manifest
- missing policy files
- duplicate runtime hints
- missing CLI tools

### `takomi-board.ps1`

Creates and updates markdown roadbooks:

- `create`
- `show`
- `add-task`
- `update-task`
- `complete-task`
- `summary`

### `takomi-policy.ps1`

Displays resolved policy context without changing it:

- model routing
- subagent routing
- lifecycle policy
- review policy

### `takomi-pi-dispatch.ps1`

Optional bridge into Pi/Takomi when available.

First pass should be conservative:

- detect only by default
- print exact command recommendations
- require explicit `-Execute` before running Pi/Takomi commands that dispatch work

### `takomi-harness.ps1`

Dry-run-first bridge for Takomi-supported harness operations:

- `status`
- `harnesses`
- `sync`
- `setup`
- `refresh`

This supports non-Pi harnesses when the user or project policy points there.

## Multi-Codex-Thread Orchestration

The skill should support multi-thread orchestration only when Codex thread tools are available.

Rules:

- Use direct work for small tasks.
- Use one child thread per independent specialist task only when the task is broad enough.
- Each child thread receives a self-contained task packet path.
- Parent thread owns synthesis and board updates.
- Child threads should not write global/user config.
- Parent thread verifies deliverables before marking tasks complete.

## Regressions To Watch

- Do not make every request create a board.
- Do not require Pi for Codex-native Takomi behavior.
- Do not silently overwrite `.pi`, `~/.pi`, or routing policies.
- Do not hard-code personal model names as universal defaults.
- Do not expose raw subagent/harness dispatch unless policies and user intent justify it.
- Do not let JSON tracking replace readable markdown roadbooks.
- Keep plugin files modular and below the 200-line guidance where practical.

## Acceptance Criteria

- A valid Codex plugin exists under `plugins/takomi-codex/`.
- The plugin includes a Takomi skill with lifecycle, policy, board, and runtime-adapter guidance.
- The plugin includes local scripts for detection, doctor checks, board operations, policy display, and optional Pi dispatch.
- The plugin works without Pi installed.
- The plugin detects Pi/Takomi state when present.
- The plugin preserves user/global config unless explicitly told to write it.
- Markdown roadbooks can be created and updated from scripts.
- The plugin can be validated with the Codex plugin validator.
- This feature doc is updated with implementation notes after build.

## Approval Gate

Implementation should begin only after the user confirms this blueprint.

## Implementation Notes

- [x] Created repo-local plugin at `plugins/takomi-codex/`.
- [x] Added repo-local marketplace metadata at `.agents/plugins/marketplace.json`.
- [x] Added `.codex-plugin/plugin.json` with Takomi-specific metadata.
- [x] Added Takomi logo assets under `plugins/takomi-codex/assets/`.
- [x] Added `skills/takomi-codex/SKILL.md` for Codex-native Takomi behavior.
- [x] Added `scripts/takomi-detect.ps1` for read-only runtime detection.
- [x] Added `scripts/takomi-doctor.ps1` for plugin and runtime readiness checks.
- [x] Added `scripts/takomi-board.ps1` for markdown roadbook creation and task updates.
- [x] Added `scripts/takomi-policy.ps1` for project/global policy display.
- [x] Added `scripts/takomi-pi-dispatch.ps1` as a conservative dry-run-first Pi/Takomi bridge.
- [x] Added `scripts/takomi-harness.ps1` as a conservative dry-run-first bridge for other Takomi-supported harnesses.
- [x] Kept plugin files modular and under 200 lines each.
- [x] Validated the plugin with the Codex plugin validator.
- [x] Smoke-tested detection, doctor, policy, board, and dispatch status commands.

## Verification

Commands run:

```powershell
python C:\Users\johno\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\plugins\takomi-codex
```

Result: plugin validation passed.

```powershell
.\plugins\takomi-codex\scripts\takomi-detect.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
.\plugins\takomi-codex\scripts\takomi-policy.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
.\plugins\takomi-codex\scripts\takomi-doctor.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite
.\plugins\takomi-codex\scripts\takomi-pi-dispatch.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite -Action status
.\plugins\takomi-codex\scripts\takomi-harness.ps1 -Root C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite -Action status
```

Result: the plugin detected project `.pi`, project profile, routing policy, policy files, user runtime folders, the `takomi` CLI, and the `pi` CLI. Doctor passed.

```powershell
.\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action create -SessionId orch-20260628-000001
.\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action add-task -SessionId orch-20260628-000001 -TaskTitle "Verify board script"
.\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action complete-task -SessionId orch-20260628-000001 -TaskId T001
.\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action summary -SessionId orch-20260628-000001
.\plugins\takomi-codex\scripts\takomi-board.ps1 -Root <temp-root> -Action show -SessionId orch-20260628-000001
```

Result: temp roadbook was created, task was added, task moved to completed, summary was written, and status showed `completed: 1`.
