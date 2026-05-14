# Orchestrator Master Plan

## Overview

- Session ID: `orch-20260514-220255`
- Title: Takomi Harness Policy & Prompt Independence Audit
- Runtime mode: hybrid
- Session intent: full-project
- Current phase: genesis queued

## Context Intake

- Vision brief: not present
- Source of truth: current project docs, the new feature blueprint, and the user request to make the harness independent from optional Takomi skill quality
- Constraint summary: preserve markdown-first authorship, keep JSON as bookkeeping, and make the default harness feel as strong as the best Takomi-guided runs

## Skills Registry

| Skill | Why It Applies |
| --- | --- |
| `takomi` | Orchestrates the lifecycle framing, session structure, and task flow |
| `sync-docs` | Keeps documentation and renderer behavior aligned once implementation begins |

## Workflows Registry

| Workflow | Phase |
| --- | --- |
| `vibe-genesis` | Audit the current harness and define the target behavior contract |
| `vibe-design` | Redesign prompt and validation architecture before coding |
| `vibe-build` | Implement the approved prompt, policy, and validation changes |

## Task Table

| # | Subtask | Mode | Workflow | Skills | Dependency | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Audit current Takomi prompt and policy flow | architect | `vibe-genesis` | `takomi` | none | pending |
| 2 | Define the target harness behavior and non-goals | architect | `vibe-genesis` | `takomi` | task 1 | pending |
| 3 | Redesign default prompts for harness independence | architect | `vibe-design` | `takomi` | task 1, task 2 | pending |
| 4 | Design validator and session-state boundaries | architect | `vibe-design` | `takomi`, `sync-docs` | task 1, task 2 | pending |
| 5 | Implement prompt and policy loading changes | code | `vibe-build` | `takomi` | task 3 | pending |
| 6 | Implement validation and state-tracking boundaries | code | `vibe-build` | `takomi`, `sync-docs` | task 4 | pending |

## Progress Checklist

- [x] Read project docs, existing session/state patterns, and Takomi workflow context
- [x] Create the feature blueprint for harness independence
- [x] Initialize orchestration session docs and machine state
- [ ] Approve the Genesis audit and behavior contract
- [ ] Approve the prompt and validator design
- [ ] Implement the renderer, prompt, and policy changes
- [ ] Verify the new orchestration format and handoff behavior

## Notes

- This session is intentionally plan-first; Build should not start until Genesis and Design outputs are reviewed.
- Human-readable docs should favor the cleaner architect-style format used in the stronger `calculator_4` experiment.
- Machine state remains the place for conversation continuity, dispatch policy, and model-specific runtime metadata.
- The feature blueprint for this session is `docs/features/Pi_Takomi_Harness_Independence.md`.
