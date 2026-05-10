# Context Source Audit: Takomi Context Manager

## Purpose

Identify the prompt/context sources currently competing in Pi + Takomi sessions and decide which context tier each source should move to.

## Key Finding

The current agent prompt loads too many unrelated context sources as always-on instructions. The problem is not that these sources are useless. The problem is that they are injected at the same priority before the user request.

## Context Tiers

| Tier | Name | Loaded When |
|---|---|---|
| 0 | Prompt Kernel | Always |
| 1 | Tool Contract | Always, concise but precise |
| 2 | Runtime State | Always, compact/structured |
| 3 | Skill Index | Always, names only |
| 4 | Candidate Context | Auto-surfaced when likely relevant |
| 5 | Manifest/Policy/Workflow Packs | On request or high-confidence match |
| 6 | Full Skill/Workflow Content | Only when actually used |

## Current Sources and Target Treatment

| Source | Current Behavior | Problem | Target Treatment |
|---|---|---|---|
| Assistant identity | Always-on | Fine | Keep in Prompt Kernel |
| Core tool list | Always-on | Fine if concise | Keep in Tool Contract |
| Tool usage rules | Always-on | Useful but can drift/repeat | Keep precise, remove duplicates |
| Pi docs routing | Always-on with detailed path map | Medium bloat | Keep compact note + docs root; detailed map as docs policy pack |
| Full available skills XML | Always-on with all descriptions/locations | Major bloat | Replace with Skill Index names only |
| Skill descriptions | Always-on | Major bloat and trigger pollution | Move to Skill Manifest |
| Full skill instructions | Read on demand today | Good | Keep as Skill Pack |
| Takomi runtime prose | Always-on | Can over-orchestrate small tasks | Replace with compact Runtime State |
| Takomi workflow playbooks | Sometimes injected by active mode | Too heavy unless stage selected | Workflow Pack only when selected |
| Full model routing policy | Always-on in project sessions | Large bloat | Policy Pack loaded before delegation/model override |
| Model registry | Always-on | Useful only for routing | Compact available provider note or load with policy |
| Project foundation warnings | Always-on | Can over-force Genesis | Compact state; apply only to large tasks |
| Subagent guidance | Always-on or repeated | Bloat unless delegation likely | Policy Pack with model routing |
| Orchestration instructions | Always-on | Causes ceremony | Kernel anti-ceremony rule + Takomi routing pack |

## Failure Mode Observed

A Genesis orchestration session was initially created with one vague foundation task for a broad meta-system project. That was insufficient.

### Classification

- **Agent behavior issue:** The assistant under-decomposed a broad project.
- **Prompt/context design issue:** Runtime guidance saying a new session usually starts with one Genesis task overpowered lifecycle judgment.
- **Tooling issue:** The board accepted a shallow task without a quality gate.

## Extension Conflict Observed

When dispatching Genesis tasks, Pi reported duplicate tool registration conflicts:

- Global `takomi-runtime` and project `.pi/extensions/takomi-runtime` both registered `takomi_workflow` and `takomi_board`.
- Global `takomi-subagents` and project `.pi/extensions/takomi-subagents` both registered `takomi_subagent`.

This should become a future Takomi runtime hardening requirement: duplicate extensions should be detected, deduped, namespaced, or clearly surfaced before subagent dispatch.

## Recommendations

1. Implement `takomi-context-manager` as a Pi extension.
2. Keep the Prompt Kernel short and stable.
3. Keep the Tool Contract high-quality and precise.
4. Replace skill descriptions with a names-only Skill Index.
5. Add `skill_manifest` and `skill_load` tools.
6. Load model/subagent policies only when delegation is relevant.
7. Keep Takomi runtime state compact.
8. Add context diagnostics so prompt bloat is visible.
9. Add orchestration-quality gates for broad projects.
