# Task: Audit current Pi/Takomi prompt bloat and context injection sources
**Task ID:** TCM-GEN-002
**Stage:** genesis
**Status:** completed
**Role:** architect
**Preferred Agent:** architect
**Conversation ID:** architect-TCM-GEN-002
**Workflow:** vibe-genesis
**Model Override:** openai-codex/gpt-5.5
**Thinking Level:** high
**Dispatch Policy:** subagent
## Context
Parent session: orch-20260510-011233

Task title: Audit current Pi/Takomi prompt bloat and context injection sources
## Objective
Map every source currently contributing to the oversized system prompt and classify each source into permanent, lazy-loaded, candidate, or removable context.
## Scope
- Current core system/developer prompt blocks
- Tool contract and tool guidance
- Pi docs routing block
- Available skills XML block
- Takomi runtime and gates
- Model registry and model routing policy
- Project foundation warnings
- Subagent guidance and orchestration hints
## Checklist
- [x] Inventory current context sources
- [x] Classify target context tiers
- [x] Record dispatch extension conflict
## Definition of Done
- A context-source inventory exists
- Each source has a proposed target tier
- Bloat risks and conflict risks are identified
- Clear recommendations exist for what remains always-on vs lazy-loaded
## Expected Artifacts
- docs/context-manager/Context_Source_Audit.md
## Dependencies
- None specified.
## Review Checkpoint
Review before implementation handoff or final completion.
## Instructions
- Use docs/features/Takomi_Context_Manager.md as the concept source.
- Be explicit about which current prompt sections should stay, shrink, move to tools, or become packs.
- Call out the 'one vague orchestration task' failure mode as an orchestration-quality problem.
## Notes
Completed directly due subagent dispatch extension conflict. Artifact: docs/context-manager/Context_Source_Audit.md