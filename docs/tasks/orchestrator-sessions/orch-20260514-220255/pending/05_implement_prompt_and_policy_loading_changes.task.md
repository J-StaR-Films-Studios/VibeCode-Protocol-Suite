# Task 05: Implement Prompt And Policy Loading Changes

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the `vibe-build` workflow before editing prompt and runtime behavior.

### Prime Agent Context
Prime the task with the approved prompt redesign, the current runtime wiring, and the shared orchestration helpers.

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Maintain orchestration flow while implementing the approved design |

## Objective

Update the harness so default prompts and policy loading deliver Takomi behavior without requiring the external skill package.

## Scope

- Edit prompt sources
- Refine policy loading defaults
- Reduce hidden dependence on skill installation
- Keep routing behavior stable

## Context

- This task exists to make the harness self-sufficient in practice, not merely in theory
- The implementation should strengthen default behavior while keeping optional skill and policy loading as enrichment
- The goal is one clear path, not a second orchestration system

## Definition Of Done

- Default prompt flow works without the skill
- Policy loading still works when available
- No regressions in orchestrator routing

## Expected Artifacts

- Updated prompt files
- Updated policy wiring
- Implementation notes

## Dependencies

- task 3

## Constraints

- Keep edits focused and reversible
- Favor the simplest code path that restores independence
- Do not introduce unnecessary orchestration plumbing
- If a file approaches the 200-line rule boundary, split responsibilities instead of stacking more logic into one place
