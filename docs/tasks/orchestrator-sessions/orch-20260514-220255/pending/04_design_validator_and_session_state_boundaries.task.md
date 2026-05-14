# Task 04: Design Validator And Session-State Boundaries

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the `vibe-design` workflow before defining validator and state boundaries.

### Prime Agent Context
Prime the task with the feature blueprint, the current session JSON contract, and the outputs from tasks 01 and 02.

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Maintain orchestration flow and lifecycle judgment |
| `sync-docs` | Keep documentation and contract changes aligned |

## Objective

Specify how the harness validates generated docs and how much state belongs in JSON versus markdown.

## Scope

- Define validation checks for docs and sessions
- Define JSON tracking fields and limits
- Define when to regenerate versus repair
- Define the minimal data contract for task and session records

## Context

- The main design question is not whether JSON exists; it is what JSON is allowed to own
- This task should protect markdown authorship quality while still giving the harness enough machine-readable state for session continuity
- FR coverage may be many-to-many across tasks, so the validator should not assume rigid one-to-one execution

## Definition Of Done

- Validator requirements are explicit
- JSON scope is minimized and justified
- Session lifecycle expectations are clear

## Expected Artifacts

- Validator spec
- State boundary spec
- Repair flow guidance

## Dependencies

- task 1
- task 2

## Constraints

- Keep the validator strict but not authoring-driven
- Treat markdown docs as primary output
- Keep JSON as the bookkeeping layer
- Account for many-to-many coverage between FRs and tasks
