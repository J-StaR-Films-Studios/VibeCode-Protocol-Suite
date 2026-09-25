---
description: Prime the agent with Takomi's standard project files, current FR work, and verification status
---
# Workflow: Prime agent

Prime the current project before complex work, after context loss, or when resuming a session. Load project facts, not every available skill. The shipped Genesis, Design, and Build workflows remain usable without the external `takomi` skill.

## 1. Check the working tree and project health

Inspect the working tree and preserve existing changes. Identify the project's verification commands from its configuration and guidelines. Run a relevant quick check when useful; report a check as "not run" rather than assuming it passed. Do not run a stack-specific command in a project that does not use that stack.

## 2. Load the standard documents

Read `AGENTS.md` and any more specific repository instructions. Then check, in order:

- `docs/Project_Requirements.md` for MUS and Future FR IDs
- `docs/Coding_Guidelines.md` for implementation and verification rules
- `docs/Builder_Prompt.md` for project-specific Build instructions
- the current `docs/issues/FR-XXX.md` file and relevant `docs/features/` plans
- `docs/design/sitemap.md`, `docs/design/design-system.html`, and relevant `docs/mockups/` when UI work is involved
- the active orchestration task packet and session plan when a task was delegated

Use established alternate paths only when the user or existing project has chosen them. Note the mapping so later agents can find the same files. Missing standard files in a new Genesis project are work to create, not a reason to invent a different layout.

## 3. Find the next work item

Find unfinished acceptance criteria in the current MUS FR issues or task packet. Identify dependencies, blockers, and the next FR or task. Load an optional specialized skill only if it helps that work.

## 4. Report the prime result

State which standard documents were found or missing, the active FR or task, incomplete criteria, checks actually run and their results, and the next action. Keep the report short enough to use as a handoff; do not present an unrun typecheck or lint as passing.
