# Task 01: Audit Current Takomi Prompt And Policy Flow

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow
Read the `vibe-genesis` workflow before starting the audit.

### Prime Agent Context
Prime the task with the current session plan, the feature blueprint, and the existing prompt/runtime files before making conclusions.

### Required Skills

| Skill | Why |
| --- | --- |
| `takomi` | Maintain orchestration flow and Genesis expectations |

## Objective

Map the current default prompts, policy loading, and skill dependency points so we can see where harness independence is being lost.

## Scope

- Inspect default prompt aliases and lifecycle prompts
- Identify where skills are required versus optional
- Trace policy loading and routing boundaries
- Summarize current failure modes and likely root causes

## Context

- The user wants the harness itself to feel Takomi-native even when the external skill is absent
- The repo already has shipped prompts, a Takomi runtime extension, a context manager, and shared orchestration helpers
- This task should expose exactly where quality depends on optional skill guidance rather than the harness's own defaults

## Definition Of Done

- Prompt and policy flow are mapped end to end
- Skill-dependent behavior is explicitly identified
- Clear improvement targets are documented

## Expected Artifacts

- Audit memo
- Prompt flow map
- Dependency leak list

## Dependencies

- none

## Constraints

- Focus on independence from user-installed skills
- Treat markdown docs as the authoring source of truth
- Separate agent instructions from machine tracking
- Call out uncertainty clearly when a behavior is inferred rather than proven
