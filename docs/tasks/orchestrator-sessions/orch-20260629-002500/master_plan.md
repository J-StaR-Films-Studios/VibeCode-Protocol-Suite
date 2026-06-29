# Delegation-First Takomi Orchestration Policy

## Goal

Define the work, route it through Takomi, and keep progress visible.

## Context Intake

- Project requirements reviewed: `docs/Project_Requirements.md` checked as the project requirements surface.
- Feature docs reviewed: Codex plugin, Pi orchestration alignment, and Pi native subagent orchestration docs.
- Runtime policy reviewed: `.pi/takomi/policies/subagent-routing.md`, `.pi/takomi/policies/takomi-lifecycle-routing.md`, `.pi/prompts/takomi-prompt.md`, and `.pi/agents/orchestrator.md`.

## Execution Mode

- Markdown roadbook for coordination and durable state.
- Delegated inspection/review support used for policy-surface discovery.
- Parent thread owns synthesis, edits, validation, and user handoff for this documentation/policy pass.
- Direct execution remains valid for small one-shot tasks and explicit user overrides.

## Tasks

| Task | Status | Notes |
| --- | --- | --- |
| T001 | completed | Updated Takomi Codex plugin skill and added a focused delegation-first feature doc. |
| T002 | completed | Updated Pi policy, prompt, orchestrator guidance, and feature docs to prefer `takomi_subagent` after decomposition. |
| T003 | completed | Plugin validator, doctor, regression tests, and skill-selection tests passed. |

## Verification

- [x] Required docs updated
- [x] Implementation verified
- [x] Summary written
