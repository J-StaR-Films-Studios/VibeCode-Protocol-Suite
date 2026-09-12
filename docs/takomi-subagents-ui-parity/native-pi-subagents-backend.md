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

## External working directories

`cwd` is launch configuration, not task prose. The following working-directory contract is normative for direct, parallel, chain, async, management, and worktree requests:

- When top-level `cwd` is omitted, the run inherits Pi's current/default project directory. When a task-level `cwd` is omitted, that task inherits the resolved parent run directory.
- A relative `cwd` resolves against its declared parent and must remain inside that parent both lexically and after realpath resolution. A symlink or Windows junction must not be used to escape the parent.
- An explicit absolute `cwd` may target an accessible directory outside the parent workspace. External absolute directories are supported intentionally; they are not workspace-escape errors.
- Every accepted directory must already exist and must be a directory. Missing paths and regular files are rejected before launch.
- Accepted paths are canonicalized with filesystem realpath resolution. Native execution, structured plan details, and rendered previews use the canonical path rather than an unresolved alias, symlink, or junction path.
- A path mentioned only in the task text never changes launch `cwd`. When task prose clearly identifies another existing project but no explicit `cwd` was supplied, Takomi may block with corrective feedback; it does not infer or launch into that directory automatically.
- Manual and preview-only delegation plans show each task's canonical `cwd`. `details.plan.tasks[*].cwd` and the rendered plan must agree with the path forwarded to native execution.
- Project-agent trust gates remain active for external directories. Selecting an external `cwd` does not authorize repository-controlled agent prompts. Discovery covers nested project-agent definitions, and project settings that override a canonical persona are treated as project control because they can alter child tools or extensions.
- Resuming a run under a root with project-controlled personas requires the same user/host authorization boundary; management actions cannot bypass the launch-time trust gate.
- A top-level external `cwd` becomes the Takomi project/profile and routing boundary for that run. A per-task absolute `cwd` changes only that child's execution directory; it does not create an independent per-task Takomi profile, routing policy, or trust scope.
- Changing `cwd` does not auto-load executable extensions from the target project. Takomi retains its explicit child-extension policy and must not scan an external target's `.pi/extensions` merely because the child executes there.

Callers should therefore omit `cwd` only for the current project, use a contained relative path for a child directory within the parent, and provide an explicit absolute path whenever the intended project is external.

## Detached async restoration boundary

Live detached async launches correctly carry canonical external directories into native `pi-subagents` execution and result handoff. Cross-restart hydration across multiple project roots is separate future work.

After a Pi/Takomi restart, Takomi does not yet claim that it can safely rediscover and hydrate every detached result launched from an external root. Supporting that requires an integrity-bound provenance design that records and validates the canonical project root, run identity, session location, and result/artifact locations without weakening path confinement. Until that design exists, the supported contract is live external async launch and handoff, not cross-restart multi-root result hydration.

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
