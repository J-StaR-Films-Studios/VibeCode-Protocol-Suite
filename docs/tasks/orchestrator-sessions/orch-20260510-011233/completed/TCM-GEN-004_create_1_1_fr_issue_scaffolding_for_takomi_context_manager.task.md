# Task: Create 1:1 FR issue scaffolding for takomi-context-manager
**Task ID:** TCM-GEN-004
**Stage:** genesis
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-GEN-004
**Workflow:** vibe-genesis
**Model Override:** openai-codex/gpt-5.4
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Create 1:1 FR issue scaffolding for takomi-context-manager
## Objective
Create one detailed issue document per functional requirement in docs/issues, preserving a 1:1 PRD requirement to issue mapping.
## Scope
- Issue labels
- User story
- Proposed solution
- Implementation flow
- Technical approach
- Key considerations
- Acceptance criteria
- Verification notes
## Checklist
- [x] Create one issue per FR
- [x] Include acceptance criteria
- [x] Include verification notes
## Definition of Done
- Every FR from docs/Project_Requirements.md has exactly one docs/issues/FR-XXX.md file
- Each issue is actionable for Design/Build
- Future issues are labeled Future
- MUS issues have clear acceptance criteria
## Expected Artifacts
- docs/issues/FR-001.md
- docs/issues/FR-002.md
- docs/issues/FR-003.md
- docs/issues/FR-004.md
- docs/issues/FR-005.md
- docs/issues/FR-006.md
## Dependencies
- TCM-GEN-003
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- Do not over-spec implementation internals too early; issues should guide Design/Build, not freeze the design.
- Acceptance criteria are the source of truth.
## Notes
Completed directly. Artifacts: docs/issues/FR-001.md through FR-012.md