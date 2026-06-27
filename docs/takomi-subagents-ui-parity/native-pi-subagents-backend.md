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
- stable Takomi `conversationId` values mapped to deterministic pi-subagents session directories
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

The implementation returns native pi-subagents `AgentToolResult<Details>` directly and delegates rendering to `renderSubagentResult()`, so the UI receives the data shape it was designed for while Takomi metadata is kept as a non-render-breaking `details.takomi` overlay. Takomi `skills` are mapped onto pi-subagents' native `skill` option, while workflow/checklist context remains in the task prompt.

## Package requirement

Takomi now requires `pi-subagents` to be installed and resolvable from the extension runtime.

Current extension code imports pi-subagents internals through a single local adapter:

```ts
import { createSubagentExecutor } from "./pi-subagents-internal";
```

The adapter wraps internal-but-exported pi-subagents modules, and `package.json` pins `pi-subagents` to `0.31.0` so upstream internal path changes cannot arrive through a caret update. If upstream exposes a stable public entry point later, Takomi should update only `.pi/extensions/takomi-subagents/pi-subagents-internal.ts`.

## Files changed

- `.pi/extensions/takomi-subagents/pi-subagents-engine.ts`
- `.pi/extensions/takomi-subagents/pi-subagents-internal.ts`
- `.pi/extensions/takomi-subagents/index.ts`
- `.pi/extensions/takomi-subagents/native-render.ts`

Runtime-board compatibility files are still retained for paths that call `dispatchTakomiSubagent` directly:

- `.pi/extensions/takomi-subagents/dispatch.ts` tracks `recentTools`, `sessionFile`, current tool metadata, and bounded `recentOutput` snapshots.
- `.pi/extensions/takomi-subagents/live-updates.ts` bridges those runtime-board snapshots into live tool updates.

They can be deleted only after runtime-board dispatch has been fully retired and verified.
