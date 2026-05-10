# Task: Define orchestration-quality requirements to prevent lazy task decomposition
**Task ID:** TCM-GEN-005
**Stage:** genesis
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-GEN-005
**Workflow:** vibe-genesis
**Model Override:** openai-codex/gpt-5.5
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Define orchestration-quality requirements to prevent lazy task decomposition
## Objective
Document the orchestration failure exposed in this conversation and define rules/checks that force appropriately detailed Takomi task decomposition when scope is broad or meta-systemic.
## Scope
- Why one-task Genesis was insufficient
- When single-task Genesis is acceptable
- When Genesis must be decomposed
- Required fields for Takomi task quality
- Fan-out heuristics
- Review checklist for orchestration sessions
- How takomi-context-manager should surface context to reduce lazy routing
## Checklist
- [x] Document failure mode
- [x] Define decomposition heuristics
- [x] Create ORCH quality issue
## Definition of Done
- A feature or issue exists for orchestration task quality
- Quality checklist is reusable
- Acceptance criteria can be tested against future sessions
## Expected Artifacts
- docs/features/Takomi_Orchestration_Task_Quality.md
- docs/issues/FR-ORCH-QUALITY.md
## Dependencies
- None specified.
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- This is now part of the project scope because the user explicitly identified it as a repeated failure mode.
- Be direct and honest about the failure.
- Do not blame tools without evidence; classify unknowns as tool limitation vs agent behavior vs prompt/context design.
## Notes
Completed directly. Artifacts: docs/features/Takomi_Orchestration_Task_Quality.md and docs/issues/FR-ORCH-QUALITY.md