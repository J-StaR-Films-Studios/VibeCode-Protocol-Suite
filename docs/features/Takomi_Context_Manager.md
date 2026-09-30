# Takomi Context Manager

## Status

Implemented lexical discovery and prompt metadata compaction, verified locally with Pi 0.99.1 synthetic fixtures. The broader kernel/firewall and retrieval design below remains a proposal where it goes beyond this shipped contract.

Shipped behavior:
- Pi already loads skill bodies on demand. Takomi additionally removes descriptions from recognized native `<available_skills>` metadata and shows a count plus up to five candidate names by default. `skill_index` returns all names; `all-names` remains optional.
- Matching uses explicit names and whole normalized words from the current user prompt only. Thresholds remain 40/100, with a configurable candidate cap of five by default. Semantic, conversation, and project retrieval are not implemented.
- Unknown skill-catalog shapes keep their original safety/tool instructions. Diagnostics report description compaction unavailable when loading guidance was appended without removal.
- The complete resolved routing policy reaches the parent model before model choice on every turn. Only an exact duplicate runtime copy is removed when runtime precedes the context manager, as in the checkout launcher. Reverse hook order conservatively retains both copies. Registry IDs, optional tool guidance, and role/workflow behavior remain available. The retained `compactModelRegistry` config key does not remove unique registry IDs.
- Routing prose and role defaults are advisory. Only an explicit `approvedModels` setting imposes a strict allowlist. Missing-policy, allowlist, and runtime-disable gates cover `takomi_subagent`, not arbitrary tools or every model selection.
- `skill_load` returns the complete file, including large packs. No truncation or pagination contract is introduced. Child agents retain fresh/replaced prompts, project context, and explicitly supplied task skills rather than automatically inheriting parent context-manager state.
- Six context tools retain their native direct-exposure defaults. Pi 0.99.1 supports deferred exposure, but no deferred loadout is enabled here.
- Diagnostics measure SYSTEM-PROMPT CHARACTERS ONLY, excluding tool schemas, history, tool results, retries, and child agents. They establish no billed-token, cache, or cost result.

Verification uses `scripts/test-context-manager-renderers.js`, `scripts/test-takomi-routing-safety.js`, and `scripts/test-takomi-gate-provenance.js`. Policies, settings, and prompts are synthetic; no live requests or personal history are required.

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
| **Skill Index** | Explicit names-only discovery; default prompt display is count plus candidates. |
| **Skill Manifest** | Optional metadata for likely skills: name, description, location. |
| **Skill Pack** | Full loaded `SKILL.md` content. |
| **Workflow Pack** | Full Takomi workflow/playbook content. |
| **Policy Pack** | Model routing, subagent routing, review gates, or similar policies. |
| **Context Router** | Logic that scores the current user request and surfaces likely context. |
| **Candidate Context** | Small hint list of likely relevant skills/workflows/policies. |
| **Context Firewall** | Proposed relevance control, not an implemented semantic filter or safety boundary. |

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

The default prompt shows a count and candidate names. The complete names-only index is available through `skill_index` or optional `all-names` display.

Example of the optional full index:

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

Selected Takomi workflows keep their existing full-first-turn and compact-reminder behavior. The context manager supplies complete resolved model-routing guidance before model choice on every turn. Other policy packs are available on demand.

Examples:

- Load `vibe-genesis` only when Genesis is selected.
- Supply model routing policy before the first model decision and on later turns.
- Load other policy packs explicitly when needed.

## Default Skill Loading Rule

```md
Skills are loaded progressively:
1. The agent receives the skill count and candidate names by default; use skill_index for all names.
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

- original and composed system-prompt character counts only
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

The shipped router scores explicit skill names and whole-word triggers in name/description metadata against the current user prompt. It returns up to five candidates by default, without loading their bodies.

Fuzzy, semantic, conversation-aware, and project-signal retrieval remain proposals requiring separate approval and verification.

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
- Keep complete model-routing policy available before choosing subagent models or overrides.
- Preserve `takomi_subagent` prerequisites and explicit approved-model settings.

## Original implementation blueprint

The kernel redesign and policy-lazy-loading steps below are historical proposals, not shipped guarantees. The status section defines retained behavior. Policy loading semantics, native exposure defaults, semantic retrieval, and full-pack continuation require separate approval.

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

## Acceptance criteria

- Recognized native skill-catalog descriptions are compacted; unknown catalog shapes retain all original instructions and report unavailable compaction.
- Default display is count plus candidates, with all names available through explicit discovery.
- The agent can request multiple skill manifests simultaneously.
- The agent can skip manifests and load a full skill directly when confident.
- Full `SKILL.md` content is loaded only for skills actually used.
- Pi docs routing remains available but does not inject full docs.
- Complete applicable model-routing policy is present before model choice, including repeated and changed-policy turns.
- Missing policy pauses supported delegation unless the user grants session-only approval. Prose does not create an implicit allowlist.
- Takomi runtime gates remain compact and usable.
- `/context-report` explains SYSTEM-PROMPT CHARACTERS ONLY. Tool schemas, history, tool results, retries, and children are excluded; no token, cache, or cost gain is claimed.

## Open Questions

- Can Pi's built-in skill XML be cleanly replaced from `before_agent_start`, or do we need a lower-level `before_provider_request` rewriter?
- Should `skill_load` return the full file every time or cache loaded skill packs per turn/session?
- Should candidate surfacing use only string matching in MVP, or add embeddings later?
- Should this ship as a project-local extension first, then become a packaged Takomi extension?
- Should the extension disable Pi's native skill command behavior or coexist with `/skill:name`?

## Recommended Next Step

Switch to Takomi orchestration mode and run Genesis/Design for `takomi-context-manager`, producing implementation tasks and a verification checklist before coding.
