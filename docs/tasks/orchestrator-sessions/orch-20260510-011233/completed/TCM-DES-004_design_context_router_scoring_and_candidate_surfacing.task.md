# Task: Design context router scoring and candidate surfacing
**Task ID:** TCM-DES-004
**Stage:** design
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-DES-004
**Workflow:** vibe-design
**Model Override:** oauth-router/gpt-5.4
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Design context router scoring and candidate surfacing
## Objective
Specify MVP candidate scoring that surfaces likely skills/workflows/policies without bloating context.
## Scope
- Exact skill name matching
- Keyword/description matching
- Recent conversation matching
- Thresholds
- Candidate hint format
- Reason tracking
- Future semantic/RAG upgrade path
## Checklist
- [x] MVP scoring algorithm defined
- [x] Thresholds defined
- [x] Candidate format defined
## Definition of Done
- MVP scoring algorithm is described
- Thresholds are defined
- Candidate output examples exist
- Future semantic upgrade is bounded
## Expected Artifacts
- docs/context-manager/Context_Router_Design.md
## Dependencies
- TCM-DES-002
- TCM-DES-003
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
## Notes
Completed directly. Artifact: docs/context-manager/Context_Router_Design.md