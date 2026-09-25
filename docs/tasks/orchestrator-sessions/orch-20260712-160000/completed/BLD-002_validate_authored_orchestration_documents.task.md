# Task BLD-002: Validate authored orchestration documents
## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Read the `vibe-build` workflow before starting this task.
### Prime Agent Context
Prime the task with the current session plan, related feature docs, and the context below before taking action.
### Optional Skill / Context Overlays
No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth.
## Objective
Ensure board validation reports missing or shallow authored markdown without overwriting human plans.
## Scope
- src/pi-takomi-core/validation.ts
-  .pi/extensions/takomi-runtime/index.ts and focused board tests
- Pi_Takomi_Harness_Independence.md
## Context
Parent session: orch-20260712-160000

Task title: Validate authored orchestration documents
## Definition Of Done
- New sessions and stage expansions flag or reject missing/shallow authored docs before reporting valid
- No partial successful session on invalid input
- Existing human-authored markdown preserved
- Focused board tests and typecheck pass
## Expected Artifacts
- Board validation logic
- Focused regression tests
- Updated harness independence feature doc
## Dependencies
- none
## Constraints
- Honor existing board APIs and authored markdown preservation.
- Do not impose arbitrary task counts or break status-only updates.
- Do not change idle-mode activation without approval.