# Task: Genesis foundation for takomi-context-manager
**Task ID:** TCM-GEN-001
**Stage:** genesis
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-GEN-001
**Workflow:** vibe-genesis
**Model Override:** openai-codex/gpt-5.5
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Genesis foundation for takomi-context-manager
## Objective
Create the project foundation artifacts for takomi-context-manager: PRD, FR-linked issue scaffolding, coding/context rules, and build handoff.
## Scope
- Clarify the mission and minimum usable state for the context manager extension
- Turn the already documented concept into functional requirements
- Create one issue file per functional requirement
- Define verification expectations for prompt bloat reduction and progressive skill loading
## Checklist
- [x] Supersede shallow single-task Genesis
- [x] Replace with detailed Genesis decomposition
- [x] Complete Genesis artifacts through expanded tasks
## Definition of Done
- docs/Project_Requirements.md exists and includes takomi-context-manager requirements
- docs/issues/FR-XXX.md files exist for each requirement
- docs/Builder_Prompt.md or equivalent handoff exists if useful
- Genesis output clearly recommends Design next
## Expected Artifacts
- docs/Project_Requirements.md
- docs/issues/FR-001.md and related issue files
- docs/Builder_Prompt.md
## Dependencies
- None specified.
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- Use docs/features/Takomi_Context_Manager.md as the source concept document.
- Do not implement code in Genesis.
- Keep requirements specific and testable.
- Preserve the user's terminology: Skill Index, Skill Manifest, Skill Pack, Prompt Kernel, Context Router, Context Firewall.
## Notes
Superseded by expanded Genesis tasks TCM-GEN-002 through TCM-GEN-006. The original one-task foundation was intentionally replaced because it was too shallow for this project.