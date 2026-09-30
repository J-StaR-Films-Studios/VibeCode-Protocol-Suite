# GEN-003: Verify compatibility and documentation boundaries

## Objective
Establish a reproducible supported Pi baseline and an honest adoption plan without turning remediation into a migration, plugin refresh or new sandbox project.

## Scope
Own I01 through I04, I06, and I08 through I17 in finding_register.md. Inspect package/version pins, private pi-subagents compatibility adapter and tests, global/project extension diagnostics, development launcher and installer ownership rules, child admission/inheritance, affected feature docs and Codex adapter claims. Read Codex comparison source only as needed.

## Working directory
Use the absolute isolated worktree cwd at `.worktrees/takomi-efficiency`, baseline 18e133d. Session master/register/packets live in the original checkout's `docs/tasks/orchestrator-sessions/orch-20260929-223951/`. Global Pi documentation is read-only under `C:/Users/johno/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/docs`; global version previously inspected as 0.99.1, package pin 0.84.4. Do not copy personal ignored settings into the worktree.

## Instructions
Read AGENTS.md, requirements and relevant feature documents before making recommendations. Read relevant Pi docs fully and examples when discussing extension APIs; use the pinned package source to check availability. No writes, installations/upgrades, live model requests, personal data scans, or modification of either global Pi or Codex. Read package/config metadata only where needed and avoid credential files. Existing duplicate registrations are a diagnostic lead, not authorization to delete anything. Examine existing native depth/capacity and trust gates before proposing new controls. Treat Codex app-server/SDK/backend and OS sandbox as deferred architecture choices. No historical task-document rename cleanup.

## Definition of done
- Every assigned finding has evidence-backed disposition and a minimal recommended action.
- Distinguish package compatibility from the active global installation, and distinguish source audit from runtime verification.
- Offer version strategies with exact prerequisites and regression checks, without upgrading dependencies.
- Recommend a reproducible isolated development/test launch that does not mutate global settings.
- State current Codex plugin portability and safety/telemetry limits accurately; identify affected docs.
- New backend, sandbox, plugin or broad private-API replacement work remains a separately approved task.

## Expected artifacts
Return a Markdown report in the final response for the orchestrator to save as `GEN-003.report.md`. Include an ID-keyed disposition table, compatibility options with trade-offs, proposed bounded Build tasks and a deferred list with reasons. Do not write files yourself.
