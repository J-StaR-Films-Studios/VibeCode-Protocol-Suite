# Task 03: Redesign Default Prompts For Harness Independence

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the `vibe-design` workflow before changing prompt architecture.

### Prime Agent Context
Prime the task with the outputs from tasks 01 and 02 plus the current prompt files before proposing rewrites.

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Maintain orchestration flow while redesigning defaults |

## Objective

Rewrite the shipped prompts so they embody Takomi behavior without requiring the external skill to be present.

## Scope

- Adjust Genesis prompt wording and constraints
- Adjust orchestrator prompt wording and constraints
- Decide where policy text belongs in defaults
- Align prompts with the strongest observed agent behavior

## Context

- The user wants the shipped harness prompts to carry the same confidence and completeness as the best Takomi-guided runs
- This is a prompt architecture task, not yet a runtime implementation task
- The goal is to improve model behavior first, not just routing mechanics

## Definition Of Done

- Default prompts are self-sufficient
- Prompt quality no longer assumes the user has a skill installed
- Genesis and orchestration prompts reflect the intended lifecycle

## Expected Artifacts

- Prompt rewrite proposal
- Before and after rationale
- Updated default prompt text

## Dependencies

- task 1
- task 2

## Constraints

- Optimize for model behavior, not just routing mechanics
- Keep prompts concise but authoritative
- Do not require JSON to explain the whole workflow
- Make the prompts feel like a strong architect is speaking, not a schema engine
