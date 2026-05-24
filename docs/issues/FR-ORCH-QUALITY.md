# FR-ORCH-QUALITY: Orchestration Task Quality Gate

## Labels

takomi, orchestration, quality, MUS

## User Story

As a Takomi user, I want broad projects decomposed into meaningful Genesis/Design/Build tasks, so that orchestration does not collapse into one vague lazy task.

## Proposed Solution

Add a quality gate and reusable checklist for Takomi task decomposition. The system should detect when a broad task is being represented by a single vague task and either expand it, require justification, or ask for confirmation.

## Implementation Flow

- Define broad-scope signals.
- Define minimum task-detail requirements.
- Add a pre-dispatch review step for task plans.
- Warn when task count/detail does not match scope.
- Record user feedback as part of future orchestration quality requirements.

## Technical Approach

This may be implemented in Takomi board/session creation logic or in `takomi-context-manager` candidate/context guidance. The first version can be documentation/checklist-backed; later versions can be automatic.

## Key Considerations

- Do not force many tasks for tiny work.
- Do not hide real complexity behind one task.
- Prefer user-visible previews before dispatch.
- Treat this as both agent behavior and tooling design.

## Acceptance Criteria

- [ ] Broad projects trigger multi-task decomposition or a written single-task justification.
- [ ] Task plans include objective, scope, DoD, expected artifacts, and dependencies.
- [ ] Pre-dispatch preview exposes shallow plans.
- [ ] The context manager project itself uses this standard.
