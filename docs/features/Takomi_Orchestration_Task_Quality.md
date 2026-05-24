# Takomi Orchestration Task Quality

## Problem

A broad Takomi project can be under-decomposed into one vague task. This happened during the initial `takomi-context-manager` Genesis setup, where a single foundation task was created despite the project spanning prompt architecture, Pi extension hooks, skill loading, model routing, diagnostics, and testing.

## Goal

Takomi should produce task plans that match project complexity. A single Genesis task is acceptable only when the work is genuinely small or the purpose is a narrow foundation artifact. Broad/meta-system projects require explicit decomposition.

## Quality Rules

### Single-task Genesis is acceptable when

- The project is small and well understood.
- The output is one focused artifact.
- There are no parallel research/design/build concerns.
- The task includes detailed scope, DoD, and acceptance criteria.

### Genesis must be decomposed when

- The work affects orchestration, prompts, tools, or agent behavior.
- There are multiple independent risk areas.
- The user is asking for a system or product, not a single file edit.
- Build/test strategy is non-trivial.
- The plan would otherwise hide important decisions inside one task.

## Required Task Fields

Every Takomi task for broad work should include:

- objective
- scope
- definition of done
- expected artifacts
- dependencies
- verification notes
- stage
- role
- model/thinking rationale when relevant

## Proposed Quality Gate

Before dispatch, Takomi should evaluate:

```txt
If scope is broad and task count <= 1, require either:
- explicit user confirmation, or
- a written justification, or
- automatic expansion into multiple tasks.
```

## Acceptance Criteria

- Broad projects are decomposed into meaningful tasks.
- One-task sessions include a clear justification.
- The board can surface shallow task plans before dispatch.
- User feedback about lazy decomposition becomes actionable project memory.
