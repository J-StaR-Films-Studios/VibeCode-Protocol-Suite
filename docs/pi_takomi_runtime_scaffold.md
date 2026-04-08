# Pi Takomi Runtime Scaffold

## Purpose

This document records the initial Pi-specific direction for Takomi.

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
  - basic auto-routing
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

They remain the source material for other harnesses and future Pi refinements.

## Planned evolution

### Phase 1
Working Pi-local prototype in `.pi/`.

### Phase 2
Deepen subagent orchestration and richer task review loops.

### Phase 3
Package as an installable Pi package.

### Phase 4
Reuse the same Takomi core logic in a dedicated Pi SDK app/runtime.

## Immediate commands in this scaffold

- `/takomi` — enable Takomi guidance for the session
- `/takomi-genesis` — activate the Genesis stage
- `/takomi-design` — activate the Design stage
- `/takomi-build` — activate the Build stage
- `/takomi-kickoff <title>` — create a default Genesis → Design → Build orchestrator session
- `/takomi-lifecycle` — show embedded lifecycle playbooks
- `/orch` — bias the session toward orchestrator behavior
- `/architect` — bias toward planning/architecture behavior
- `/code` — bias toward implementation behavior
- `/review` — bias toward review behavior
- `/takomi-plan` — toggle lightweight planning bias
- `/autoorch` — toggle lightweight automatic orchestration routing
- `/takomi-reset` — clear Takomi runtime state

## Important lifecycle note

The Pi-specific runtime now explicitly models the Vibe Code Protocol:
- **Genesis**
- **Design**
- **Build**

Intended behavior:
1. Genesis creates the project foundation.
2. Design turns that into build-ready UI/UX direction, ideally with a Gemini-class design-capable model.
3. Build uses orchestration plus specialist subagents.
4. During Build, work may be reviewed and then sent back to the **same agent** by reusing its `conversationId`, instead of restarting the task from scratch.

## Notes

This is still an early scaffold, but it now includes the three major foundations we wanted:
- real subagent orchestration using Pi's extension pattern
- embedded workflow playbooks inside the runtime layer
- SDK-shared Takomi core modules for future reuse
