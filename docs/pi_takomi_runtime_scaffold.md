# Pi Takomi Runtime Scaffold

## Purpose

This document records the Pi-specific direction for Takomi.

Goals:
- keep existing cross-harness Takomi assets untouched
- create a Pi-native prototype that can be loaded immediately by Pi
- make the Pi runtime as self-contained as possible
- prepare for later reuse inside a Pi SDK application

## Why the scaffold lives in `.pi/`

The first working prototype is placed in the project root `.pi/` directory because Pi auto-discovers project-local resources there.

This gives us:
- zero-install local testing in this repository
- fast iteration with `/reload`
- a direct path to later packaging

Later, the same logic can be moved or duplicated into a distributable package under something like `assets/pi/` or `packages/pi-takomi/`.

## What is included in this scaffold

- `.pi/extensions/takomi-runtime/`
  - Pi-native runtime glue
  - command registration
  - Takomi lifecycle and state tracking
  - route and orchestration guidance
  - embedded workflow playbooks
  - orchestrator board tools for task/session artifacts
- `.pi/extensions/takomi-subagents/`
  - project-local subagent orchestration using separate Pi processes
  - resumable conversation IDs so a task can be sent back to the same agent
- `.pi/prompts/`
  - Pi-native prompt shortcuts for Takomi entrypoints
- `.pi/agents/`
  - distilled Pi-native agent definitions including a Gemini-oriented design agent
- `src/pi-takomi-core/`
  - SDK-shareable Takomi core modules for workflows, routing, and orchestration helpers
- `.pi/README.md`
  - quick explanation of the prototype structure

## What is intentionally not changed

These existing assets remain untouched:
- `assets/.agent/workflows/*`
- `assets/.agent/skills/*`
- `assets/Takomi-Agents/*.yaml`

They are retained as historical and cross-harness reference material.
They are not meant to be runtime dependencies for the Pi-native Takomi experience, which should remain self-contained in `.pi/` plus the embedded Takomi core.

## Planned evolution

### Phase 1
Working Pi-local prototype in `.pi/`.

### Phase 2
Deepen subagent orchestration and richer task review loops.

Current progress inside the scaffold:
- hybrid session persistence is implemented
- human-readable board artifacts are written to `docs/tasks/orchestrator-sessions/<sessionId>/`
- machine state is written to `.pi/takomi/orchestrator/<sessionId>.json`
- task packets can carry workflow, skills, model override, conversationId, and checklist metadata
- lifecycle sessions now start Genesis-first and can expand later stages dynamically

### Phase 3
Package as an installable Pi package.

### Phase 4
Reuse the same Takomi core logic in a dedicated Pi SDK app/runtime.

## Immediate commands in this scaffold

- `/takomi` - enable Takomi guidance for the session
- `/takomi-genesis` - activate the Genesis stage
- `/takomi-design` - activate the Design stage
- `/takomi-build` - activate the Build stage
- `/takomi-kickoff <title>` - create a Genesis-first orchestration session
- `takomi_board` - create sessions, expand stages, update tasks, and support redispatch review loops
- `/takomi-lifecycle` - show embedded lifecycle playbooks
- `/orch` - bias the session toward orchestrator behavior
- `/architect` - bias toward planning and architecture behavior
- `/code` - bias toward implementation behavior
- `/review` - bias toward review behavior
- `/takomi-plan` - toggle lightweight planning bias
- `/autoorch` - toggle lightweight automatic orchestration routing
- `/takomi-reset` - clear Takomi runtime state
- prompt-template aliases are intentionally suffixed with `-prompt` to avoid name collisions with runtime commands, for example `/orch-prompt` and `/build-prompt`

## Important lifecycle note

The Pi-specific runtime explicitly models the Vibe Code Protocol:
- Genesis
- Design
- Build

Intended behavior:
1. Genesis creates the project foundation and the required markdown artifacts.
2. Design turns that into build-ready UI and UX direction, ideally with a strong design-capable model.
3. Build is a workflow/stage layer that uses orchestration plus specialist subagents; it is not meant to duplicate the coder role.
4. A new orchestration session starts with a Genesis foundation task, then expands Design and Build only when the scope justifies it.
5. Follow-up work should be judged intelligently:
   - one-shot when it is small
   - session expansion when it belongs to the current lifecycle
   - a fresh orchestration session when the request is large and multi-part
6. During Build, work may be reviewed and then sent back to the same agent by reusing its `conversationId`, instead of restarting the task from scratch.
7. The board/runtime uses a hybrid architecture:
   - visible docs for human inspection
   - hidden JSON state for machine tracking
8. Task packets may specify:
   - `workflow`
   - `skills`
   - `preferredModel`
   - `conversationId`
   - `checklist`

## Notes

This is still an early scaffold, but it includes the major foundations we wanted:
- real subagent orchestration using Pi's extension pattern
- embedded workflow playbooks inside the runtime layer
- SDK-shared Takomi core modules for future reuse
- hybrid board persistence across docs and JSON state
- subagent task packets with workflow, skills, model, and checklist metadata
- board-driven stage expansion, task updates, checklist progress updates, status folder regeneration, and same-conversation redispatch
- a dedicated `review_and_redispatch` action for review-loop continuity
