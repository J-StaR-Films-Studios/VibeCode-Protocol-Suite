# Takomi Subagents Native pi-subagents Backend

## Decision

Takomi subagent execution will use `pi-subagents` as the single execution and UI backend.

We are no longer maintaining a separate Takomi JSON runner for interactive `takomi_subagent` runs. Takomi remains the orchestration/routing layer; `pi-subagents` owns process execution, live progress collection, session files, tool tracking, parallel/chain mechanics, and TUI rendering.

## Unified agent format

Takomi agents now use the native pi-subagents markdown agent format:

- User/global agents: `~/.pi/agent/agents/**/*.md`
- Project agents: `.pi/agents/**/*.md`
- Legacy project agents: `.agents/**/*.md`

Takomi-specific frontmatter may be added as optional metadata. pi-subagents keeps unknown fields as `extraFields`; Takomi can read them later.

Example:

```md
---
name: architect
description: Plan, design, and clarify before implementation.
model: oauth-router/gpt-5.5
thinking: high
tools: read,grep,find,ls,bash
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
defaultContext: fresh
defaultProgress: true

takomiRole: architect
takomiStages: genesis,design
takomiWorkflows: vibe-genesis,vibe-design
---
You are the Takomi Architect.
```

## Execution flow

```txt
takomi_subagent(params)
  -> resolve mode: single | parallel | chain
  -> resolve Takomi aliases / workflow metadata / model fields
  -> enrich task prompt with Takomi workflow, skills, checklist, and prior chain output markers
  -> call pi-subagents createSubagentExecutor(...).execute(...)
  -> return native AgentToolResult<Details>
  -> render using pi-subagents renderSubagentResult()
```

## What Takomi still owns

- Genesis/Design/Build lifecycle semantics
- board/task/checklist context
- model-routing policy values passed as `model` / `thinking`
- workflow prompt overlays
- agent aliases such as `code -> coder`
- launch preview/manual gate

## What pi-subagents owns

- child process spawning
- live progress collection
- tool call tracking
- token/usage capture
- final output capture
- session files
- foreground/async/parallel/chain execution
- native TUI rendering

## Why this fixes the UI problem

The prior implementation used pi-subagents' renderer but fed it Takomi JSON-runner snapshots. Those snapshots could include planning/self-talk and cumulative text, causing duplicated or dirty live output.

The new implementation returns native pi-subagents `AgentToolResult<Details>` directly, so the UI receives the data shape it was designed for.

## Package requirement

Takomi now requires `pi-subagents` to be installed and resolvable from the extension runtime.

Current import path used by the extension:

```ts
import { createSubagentExecutor } from "pi-subagents/src/runs/foreground/subagent-executor";
```

This uses an internal-but-exported module from the package. If upstream changes the internal path, Takomi must update the adapter or vendor/fork a small stable API.

## Files changed

- `C:/Users/johno/.pi/agent/extensions/takomi-subagents/pi-subagents-engine.ts`
- `C:/Users/johno/.pi/agent/extensions/takomi-subagents/tool-runner.ts`
- `C:/Users/johno/.pi/agent/extensions/takomi-subagents/native-render.ts`

Legacy files retained but no longer used by the main `takomi_subagent` path:

- `dispatch.ts`
- `live-updates.ts`

They can be deleted after a few successful test passes.
