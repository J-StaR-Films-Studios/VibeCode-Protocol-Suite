# Takomi Context Manager

## Status

Proposed feature / implementation blueprint.

## Working Name

**takomi-context-manager**

## Problem

Pi + Takomi currently inject too much always-on context before the user request. The current prompt can include tool instructions, Pi documentation routing, full skill descriptions, Takomi runtime guidance, full model-routing policy, workflow notes, model registry data, and project gates in one large block.

That makes the agent slower, more ceremonial, and more likely to over-apply unrelated instructions. The information is useful, but it is loaded at the wrong time and at the wrong priority.

## Goal

Build a Pi extension that manages context with progressive disclosure:

> Always load only the kernel. Surface likely context. Load full instructions only when the agent actually needs them.

The extension should reduce prompt bloat while preserving agent capability and tool quality.

## Non-Goals

- Do not remove Pi's core tools.
- Do not make tool instructions vague or mediocre.
- Do not hide skills completely from the agent.
- Do not force Takomi orchestration for small tasks.
- Do not fork Pi internals unless extension hooks are insufficient.

## Core Terminology

| Term | Meaning |
|---|---|
| **Prompt Kernel** | Small always-on identity, behavior, and safety rules. |
| **Tool Contract** | Tool names, capabilities, schemas, and important usage rules. |
| **Runtime State** | Compact current facts: cwd, date, execution mode, Takomi gates, etc. |
| **Skill Index** | Always-visible list of skill names only. |
| **Skill Manifest** | Optional metadata for likely skills: name, description, location. |
| **Skill Pack** | Full loaded `SKILL.md` content. |
| **Workflow Pack** | Full Takomi workflow/playbook content. |
| **Policy Pack** | Model routing, subagent routing, review gates, or similar policies. |
| **Context Router** | Logic that scores the current user request and surfaces likely context. |
| **Candidate Context** | Small hint list of likely relevant skills/workflows/policies. |
| **Context Firewall** | The rule/system that blocks irrelevant context from entering the prompt. |

## Context Loading Model

### Level 0: Prompt Kernel

Always loaded. Short and stable.

Includes:

- Pi/Takomi coding assistant identity.
- Core response style.
- Core safety rules.
- Task sizing rule.
- Anti-ceremony rule.
- Instruction to use the minimum relevant context.

### Level 1: Tool Contract

Always loaded or loaded through Pi's normal tool prompt mechanism.

Keep this useful and precise. Do not over-compress it into vague statements.

Includes:

- `read`
- `bash`
- `edit`
- `write`
- `takomi_workflow`
- `takomi_board`
- `takomi_subagent`
- extension tools registered by `takomi-context-manager`

Important edit rules should remain visible because they prevent real mistakes.

### Level 2: Skill Index

Always visible, but names only.

Example:

```txt
Available skills:
- takomi
- optimize-agent-context
- nextjs-standards
- pdf
- xlsx
- pi-subagents
```

The index preserves discoverability without injecting every description.

### Level 3: Skill Manifest

Loaded on request or surfaced automatically for likely matches.

A manifest includes:

```txt
Skill: optimize-agent-context
Description: Create, audit, or optimize agent context files...
Location: C:\Users\...\optimize-agent-context\SKILL.md
```

Multiple manifests can be requested together.

### Level 4: Skill Pack

Full `SKILL.md` loaded only when the agent will actually use it.

The middle manifest step is optional:

- If unsure: `Skill Index -> Skill Manifest -> Skill Pack`
- If sure: `Skill Index -> Skill Pack`
- If the user names the skill directly: `Skill Index -> Skill Pack`

### Level 5: Workflow and Policy Packs

Takomi workflows and routing policies are loaded only when relevant.

Examples:

- Load `vibe-genesis` only when Genesis is selected.
- Load model routing policy only before subagent/model delegation.
- Load subagent routing policy together with model routing policy.

## Default Skill Loading Rule

```md
Skills are loaded progressively:
1. The agent always receives the skill index: skill names only.
2. For uncertain matches, request manifests for likely skills. A manifest includes description and location.
3. If a skill is clearly relevant or the user names it directly, load the full `SKILL.md` without requesting a manifest first.
4. Load full skill instructions only for skills you will actually use.
```

## Proposed Pi Extension

### Name

`takomi-context-manager`

### Location

Project-local during development:

```txt
.pi/extensions/takomi-context-manager/index.ts
```

Later it can ship as part of the Takomi package and be installed globally.

### Primary Hooks

Use Pi extension hooks:

- `resources_discover`: optionally contribute package resources.
- `before_agent_start`: rewrite/compact the system prompt and inject candidate context.
- `context`: optionally prune or rewrite message context non-destructively.
- `before_provider_request`: optional last-resort provider payload inspection/debugging.

### Registered Tools

#### `skill_index`

Returns the available skill names.

Use when the agent needs to inspect the skill list explicitly.

#### `skill_manifest`

Parameters:

```ts
{
  skills: string[]
}
```

Returns name, description, and location for the requested skills.

#### `skill_load`

Parameters:

```ts
{
  skill: string
}
```

Returns the full `SKILL.md` content for the requested skill.

#### `context_report`

Returns diagnostics for the current or most recent prompt build:

- prompt size estimate
- loaded packs
- candidate packs
- skipped packs
- skill index count
- reason each context pack was included

### Optional Commands

#### `/context-report`

Human-readable context report.

#### `/skill-manifest <skill...>`

Manual manifest lookup.

#### `/skill-load <skill>`

Manual skill load for testing.

## Prompt Kernel Draft

```txt
You are an expert coding assistant operating inside Pi, a local coding agent harness.

You help users inspect code, run commands, edit files, write new files, and reason about software projects.

Use the minimum context needed to solve the task correctly.
Prefer focused execution over ceremony.

Core rules:
- Inspect before editing.
- Use bash for search, git, package scripts, and file operations.
- Use read instead of cat/sed when examining file contents.
- Use edit for precise changes.
- Use write only for new files or complete rewrites.
- Keep responses concise.
- Show changed file paths clearly.

Task sizing:
- Small clear task: execute directly.
- Medium task: inspect, plan briefly, implement, verify.
- Large, unclear, risky, or multi-agent task: use Takomi lifecycle.
- Do not force orchestration for small tasks.

Context loading:
- Skills are loaded progressively: index -> manifest if uncertain -> full SKILL.md only when used.
- Load Pi documentation only when the user asks about Pi itself.
- Load Takomi workflow packs only when that workflow is selected.
- Load model-routing and subagent policy packs only before delegation/model override.
```

## Automatic Candidate Surfacing

The extension should score likely context using a hybrid approach:

1. Exact skill name match.
2. Keyword/trigger match from skill descriptions.
3. Fuzzy match against the user request.
4. Conversation-aware match using recent user turns or a compact summary.
5. Project signals such as filenames, framework, or active Takomi stage.

Injected candidate hint should stay small:

```txt
Potentially relevant context:
- optimize-agent-context
- takomi
- pi-subagents

Use skill_manifest if uncertain, or skill_load if clearly relevant.
```

## Takomi-Specific Behavior

Keep compact Takomi runtime state available, but do not inject full workflow prose unless selected.

Example compact state:

```json
{
  "takomi": {
    "available": true,
    "executionMode": "direct",
    "gate": "auto",
    "sessionRecommendation": "consider",
    "foundation": "missing"
  }
}
```

Rules:

- Keep Takomi session gates compact.
- Keep project foundation notes compact.
- Load Genesis/Design/Build playbooks only when selected.
- Load model routing policy when invoking subagents or choosing model overrides.
- Load subagent routing policy together with model routing policy.

## Implementation Plan

### Phase 1: Discovery and Baseline

- Inspect current Pi prompt construction behavior through extension hooks.
- Capture current prompt length and sections.
- Identify how `systemPromptOptions.skills` is shaped.
- Confirm whether skills can be suppressed/reformatted from `before_agent_start` alone.
- Add `/context-report` for baseline visibility.

### Phase 2: Skill Index and Manifest Tools

- Build skill discovery from `event.systemPromptOptions.skills` where possible.
- Normalize skill records into `{ name, description, location }`.
- Register `skill_index`.
- Register `skill_manifest`.
- Register `skill_load`.
- Support multiple manifest requests in one call.
- Ensure paths are resolved and `SKILL.md` reads are safe.

### Phase 3: Prompt Rewriter

- Replace the verbose `<available_skills>` block with skill names only.
- Preserve core tool contract and useful edit rules.
- Preserve Pi docs routing notes in compact form.
- Compress model routing to a one-line availability note unless delegation is active.
- Compress Takomi runtime state into structured compact text.
- Add explicit progressive skill loading rule.

### Phase 4: Candidate Router

- Score user prompt against skill metadata.
- Inject only top likely candidates.
- Add thresholds:
  - high confidence: suggest direct `skill_load`.
  - medium confidence: suggest `skill_manifest`.
  - low confidence: no candidate injection.
- Include reason strings for diagnostics.

### Phase 5: Policy and Workflow Packs

- Move model routing into a policy pack.
- Move subagent routing into a policy pack.
- Load both when subagent delegation is relevant.
- Ensure Takomi workflow playbooks remain loaded only by selected lifecycle stage.

### Phase 6: Testing and Verification

Test in local project with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Alternative manual test:

```powershell
cd ..
pi
```

Verification cases:

1. Simple task: no skill descriptions injected.
2. User names a skill: full skill can be loaded directly.
3. Vague prompt: candidate skills are surfaced without full packs.
4. Manifest request: descriptions and locations return for multiple skills.
5. Full skill load: exact `SKILL.md` content is returned.
6. Subagent delegation: model routing + subagent policy are available together.
7. Takomi Genesis request: Genesis workflow loads only when selected.
8. Context report: shows included/skipped context and estimated prompt size.

## Acceptance Criteria

- The always-on prompt no longer includes full descriptions for every skill.
- The agent always has a names-only skill index.
- The agent can request multiple skill manifests simultaneously.
- The agent can skip manifests and load a full skill directly when confident.
- Full `SKILL.md` content is loaded only for skills actually used.
- Pi docs routing remains available but does not inject full docs.
- Model routing policy is not always fully injected.
- Model routing and subagent routing are available together when delegating.
- Takomi runtime gates remain compact and usable.
- `/context-report` or equivalent diagnostics can explain prompt composition.

## Open Questions

- Can Pi's built-in skill XML be cleanly replaced from `before_agent_start`, or do we need a lower-level `before_provider_request` rewriter?
- Should `skill_load` return the full file every time or cache loaded skill packs per turn/session?
- Should candidate surfacing use only string matching in MVP, or add embeddings later?
- Should this ship as a project-local extension first, then become a packaged Takomi extension?
- Should the extension disable Pi's native skill command behavior or coexist with `/skill:name`?

## Recommended Next Step

Switch to Takomi orchestration mode and run Genesis/Design for `takomi-context-manager`, producing implementation tasks and a verification checklist before coding.
