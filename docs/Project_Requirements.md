# Project Requirements Document

## Project Overview

**Name:** takomi-context-manager

**Mission:** Reduce Pi/Takomi prompt bloat by replacing always-on context dumps with progressive, task-aware context loading.

**Tech Stack:** Pi TypeScript extension, Node.js, TypeScript, TypeBox, Pi extension APIs, Takomi workflow/runtime integration.

## Functional Requirements

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-001 | Prompt Kernel and Tool Contract | As a Pi/Takomi user, I want a compact always-on prompt with strong tool guidance, so that agents stay capable without being overloaded. | MUS |
| FR-002 | Skill Index | As an agent, I want to see available skill names only by default, so that I know capabilities exist without receiving every skill description. | MUS |
| FR-003 | Skill Manifest Tool | As an agent, I want to request descriptions and locations for multiple likely skills at once, so that I can choose relevant skills without loading full instructions. | MUS |
| FR-004 | Skill Pack Loader | As an agent, I want to load the full `SKILL.md` for a chosen skill, so that I can apply detailed instructions only when needed. | MUS |
| FR-005 | Context Router Candidate Surfacing | As an agent, I want likely skills/workflows/policies suggested from the user request and conversation, so that I can load relevant context faster. | MUS |
| FR-006 | Compact Takomi Runtime and Policy Packs | As a Takomi orchestrator, I want runtime gates compact and routing policies lazy-loaded, so that orchestration remains available without dominating every turn. | MUS |
| FR-007 | Context Diagnostics | As a developer, I want a context report showing what was injected, suggested, loaded, or skipped, so that prompt bloat is observable and debuggable. | MUS |
| FR-008 | Orchestration Task Quality Gate | As a Takomi user, I want broad projects decomposed into meaningful Genesis/Design/Build tasks, so that orchestration does not collapse into one vague lazy task. | MUS |
| FR-009 | Duplicate Extension Conflict Detection | As a Pi/Takomi user, I want duplicate global/project Takomi extensions detected or mitigated, so that subagent dispatch does not fail on tool registration conflicts. | Future |
| FR-010 | Semantic/RAG Skill Matching | As an agent, I want semantic matching beyond keyword triggers, so that vague prompts still surface relevant context packs. | Future |
| FR-011 | Context Pack Caching | As a developer, I want loaded manifests/packs cached per turn or session, so that repeated context loading is efficient. | Future |
| FR-012 | Interactive Context UI | As a user, I want a UI/command surface to inspect candidates and loaded context, so that I can understand and steer the context manager. | Future |

## Non-Functional Requirements

- The always-on prompt should be significantly shorter than the current 500+ line prompt.
- Tool guidance must stay precise; prompt reduction must not make tool usage mediocre.
- Full skill instructions should load only when explicitly used or confidently required.
- The extension should be project-local first and package-ready later.
- Diagnostics must explain inclusion decisions in human-readable form.

## Terminology

- **Prompt Kernel:** compact always-on identity and behavior contract.
- **Tool Contract:** tool list, schemas, and critical tool rules.
- **Skill Index:** names-only list of available skills.
- **Skill Manifest:** name, description, and location for selected skills.
- **Skill Pack:** full `SKILL.md` content.
- **Context Router:** scoring logic that surfaces likely context.
- **Context Firewall:** guardrail preventing irrelevant packs from entering the prompt.
- **Policy Pack:** model/subagent/review routing policy loaded on demand.
- **Workflow Pack:** full Takomi workflow loaded only when selected.
