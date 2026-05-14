# Task 02: Define The Target Harness Behavior And Non-Goals

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the `vibe-genesis` workflow before defining the behavior contract.

### Prime Agent Context
Prime the task with the feature blueprint and the findings from task 01 before locking any conclusions.

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Maintain orchestration flow and Genesis expectations |

## Objective

Decide what the harness must do by default, what the Takomi skill should remain optional for, and what should never depend on external skills.

## Scope

- State the desired independent default behavior
- Separate product behavior from optional skill packaging
- Define non-goals for JSON and orchestration plumbing
- Produce the decision record for the harness direction

## Context

- The repo already has multiple Takomi layers, so the job here is to draw cleaner boundaries
- This task should decide what belongs to prompts, what belongs to runtime/shared core, and what belongs only to bookkeeping
- The recommendation should stay practical for the current codebase, not turn into theory-only architecture

## Definition Of Done

- Independence contract is explicit
- JSON and docs responsibilities are separated
- A clear recommendation is available for prompt strategy

## Expected Artifacts

- Behavior contract
- Non-goals list
- Decision memo

## Dependencies

- task 1

## Constraints

- Assume the harness must work even without the Takomi skill
- Prefer direct markdown authorship over JSON-first generation
- Make the recommendation practical for the current codebase
- Do not propose abstractions that only sound elegant on paper
