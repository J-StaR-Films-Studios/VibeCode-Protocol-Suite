# Takomi Delegation-First Orchestration

## Goal

Make Takomi delegation-first once it decomposes work, while preserving direct execution for small one-shot tasks.

## Policy

- Small, clear, local tasks stay direct.
- Broad work may create subtasks, roadbook tasks, or an orchestration session.
- Once decomposition happens, the main agent becomes the orchestrator by default.
- The orchestrator owns context intake, task packets, sequencing, board updates, synthesis, acceptance, redispatch, and final user handoff.
- Implementer subagents or child threads execute task packets.
- Reviewer subagents or child threads review implementation output before acceptance.
- Markdown roadbooks remain the durable source of truth.

## User Overrides

The main agent may execute directly when the user says:

- "do it yourself"
- "no subagents"
- "no new threads"
- `/takomi subagents off`
- equivalent direct-execution language

The main agent may also execute directly when delegation tooling is unavailable, but should keep any roadbook or task packet current.

## Pi Behavior

Pi should prefer `takomi_subagent` for decomposed work:

1. Implementer `takomi_subagent` executes the task.
2. Reviewer `takomi_subagent` reviews the result.
3. Main orchestrator synthesizes and updates `takomi_board`.
4. Main orchestrator accepts or redispatches with a tighter packet.

## Codex Behavior

Codex should prefer child Codex threads when thread tools are available:

1. Parent creates or updates the markdown roadbook.
2. Parent sends implementer task packets to child threads.
3. Parent sends reviewer packets to separate child threads.
4. Parent synthesizes, verifies, updates the roadbook, and hands off.

If thread tools are unavailable, the parent creates markdown task packets and executes directly as fallback.

## Acceptance Criteria

- Takomi Codex skill says decomposition implies delegation-first orchestration.
- Pi policy says orchestration sessions use subagents by default.
- Main agent remains responsible for synthesis and user handoff.
- Direct one-shot tasks are not over-orchestrated.
- User override rules are explicit.
- Plugin validation passes.
