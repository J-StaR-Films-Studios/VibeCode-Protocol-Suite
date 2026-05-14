# Task 06: Implement Validation And State-Tracking Boundaries

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the `vibe-build` workflow before implementing validator and serialization changes.

### Prime Agent Context
Prime the task with the approved validator/state-boundary design and the current orchestration persistence contract.

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Maintain orchestration flow while implementing the approved design |
| `sync-docs` | Keep documentation and persistence-contract changes aligned |

## Objective

Implement the validator and session-state rules so markdown remains the source of truth and JSON stays a tracking layer.

## Scope

- Add or refine post-pass validators
- Limit JSON to metadata and task/session tracking
- Add repair or report outputs when docs fail validation
- Ensure session artifacts stay human-readable

## Context

- The goal is to make validation protective and useful without turning authored docs into a rigid mirror of JSON
- The harness should track what it needs and no more
- Failure output should help the agent repair the docs rather than drift away from them

## Definition Of Done

- Validator catches missing or malformed outputs
- JSON and markdown responsibilities are clear in code
- Failure output helps the agent repair rather than drift

## Expected Artifacts

- Validator implementation
- State serialization changes
- Repair diagnostics

## Dependencies

- task 4

## Constraints

- Make validation helpful, not punitive
- Avoid serializing unnecessary authoring detail into JSON
- Prefer explicit contracts over clever inference
- Update docs if implementation changes the task or session contract
