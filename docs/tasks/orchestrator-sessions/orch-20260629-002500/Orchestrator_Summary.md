# Delegation-First Takomi Orchestration Policy

## Outcome

Implemented a delegation-first Takomi policy across the Codex plugin skill and Pi runtime guidance.

## Changed

- Takomi Codex now says decomposition implies delegation-first orchestration.
- Pi policy now defaults decomposed orchestration to `takomi_subagent` implementer and reviewer runs.
- Explicit direct-execution overrides are documented: "do it yourself", "no subagents", "no new threads", and `/takomi subagents off`.
- Markdown roadbooks remain the durable source of truth.
- Main agent responsibility is explicit: synthesize, update the roadbook/board, accept or redispatch, and hand off to the user.

## Verification

- Codex plugin validator passed.
- Takomi Codex doctor passed.
- Regression tests passed.
- Skill-selection tests passed.
