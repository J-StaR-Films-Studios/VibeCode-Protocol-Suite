# Task: Design prompt rewriting and context firewall strategy
**Task ID:** TCM-DES-003
**Stage:** design
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-DES-003
**Workflow:** vibe-design
**Model Override:** oauth-router/gpt-5.5
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Design prompt rewriting and context firewall strategy
## Objective
Define how the extension will compact the system prompt while preserving high-quality tool guidance.
## Scope
- before_agent_start strategy
- systemPromptOptions usage
- Skill XML replacement approach
- Prompt Kernel block
- Tool Contract preservation
- Takomi runtime compact block
- Fallback if prompt rewriting is brittle
- Diagnostics hooks
## Checklist
- [x] Prompt rewrite strategy explicit
- [x] Always-on vs lazy-loaded enumerated
- [x] Fallback risks documented
## Definition of Done
- Prompt rewrite strategy is explicit
- What remains always-on is enumerated
- What gets removed/lazy-loaded is enumerated
- Risks/fallbacks are documented
## Expected Artifacts
- docs/context-manager/Prompt_Rewrite_Design.md
## Dependencies
- TCM-GEN-002
- TCM-GEN-003
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- complete the task within scope
- use the listed workflow and skills when they are provided
- report blockers clearly
- if review sends this back, continue using the same conversation id when possible
- summarize what changed and what remains
## Notes
Completed directly. Artifact: docs/context-manager/Prompt_Rewrite_Design.md