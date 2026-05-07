# Takomi Subagent Unification Plan

## Goal

Make **Takomi subagent** the primary user-facing subagent interface while using the maintained **Pi subagents** library as the underlying execution engine.

The desired end state is:

```text
Takomi owns lifecycle orchestration.
Pi subagents owns low-level execution.
Users interact with Takomi.
```

This avoids maintaining two competing subagent systems while preserving the stronger feature set of Pi subagents.

---

## Current Problem

There are currently two visible subagent concepts:

```text
subagent          # Pi subagent engine
takomi_subagent   # Takomi lifecycle-aware subagent wrapper
```

This creates confusion because:

- Pi subagents are more feature-complete.
- Takomi subagents are better aligned with Genesis, Design, and Build workflows.
- Users should not need to know which system to call.
- Pi subagents may not be installed by default unless the user installs the package separately.

The product problem is not that two systems exist internally. The problem is that both are exposed as separate user-facing choices.

---

## Recommended Architecture

Use Pi subagents as a dependency/runtime engine and wrap it with Takomi lifecycle behavior.

```text
takomi_board
  ↓
takomi_subagent
  ↓
pi-subagents runtime
```

### Responsibilities

| Layer | Responsibility |
|---|---|
| `takomi_board` | Session, stage, task, review, and lifecycle orchestration |
| `takomi_subagent` | User-facing task delegation with Takomi context and workflow metadata |
| `pi-subagents` | Agent discovery, execution, chains, parallelism, async, resume, worktrees, diagnostics |

Takomi should not reimplement Pi subagents unless absolutely necessary.

---

## Why Wrap Instead of Forking or Rewriting

Pi subagents already handles complex runtime behavior:

- Agent discovery
- Agent inspection
- Single-agent execution
- Parallel execution
- Chained execution
- Async/background runs
- Status checks
- Interrupt/resume
- Fresh/forked context control
- Worktree isolation
- Output files
- Progress tracking
- Diagnostics
- Agent management
- User/project agent scopes

These features are execution-engine concerns, not lifecycle concerns.

Takomi’s unique value is different:

- Genesis → Design → Build workflow
- Board/session/task artifacts
- Functional requirement tracking
- Issue generation
- Verification gates
- Review and redispatch loops
- Builder handoff structure
- Project lifecycle continuity

Therefore, the clean separation is:

```text
Pi subagents = execution engine
Takomi = orchestration product
```

---

## Target User Experience

Users should primarily see and use:

```text
takomi_board
takomi_subagent
takomi_workflow
```

Direct use of raw Pi `subagent` should be considered advanced/internal.

A user should be able to say:

> Use Takomi to create a Genesis board and dispatch agents.

Without knowing whether Pi subagents is powering the execution underneath.

---

## Current State Snapshot

As of this implementation pass, the actual state is:

```text
Visible tools available in Pi:
- subagent
- takomi_subagent
```

### What each tool currently is

- `subagent`
  - The raw Pi subagent tool.
  - More feature-complete today.
  - Best treated as advanced/internal for Takomi-oriented workflows.

- `takomi_subagent`
  - The Takomi-facing lifecycle-aware wrapper.
  - Preferred tool for Takomi workflows.
  - Supports Takomi concepts like workflow overlays, checklist metadata, `conversationId`, plan preview, and board alignment.

### Important implementation reality

Takomi does **not** currently invoke Pi's `subagent` tool directly.

Instead:

- `takomi_subagent` uses Takomi's own wrapper implementation in `.pi/extensions/takomi-subagents/`
- it follows Pi-style execution semantics
- it uses Pi-native result rendering patterns
- it shares the same overall execution model conceptually
- but it is **not yet** a literal tool-to-tool passthrough into `subagent`

This matters for future refactors: other agents should not assume that `takomi_subagent` already delegates by calling raw `subagent` internally.

### What is bundled now

Bundled in this repo/package:

- `src/pi-takomi-core/`
- `.pi/extensions/takomi-runtime/`
- `.pi/extensions/takomi-subagents/`
- `.pi/prompts/`
- `.pi/agents/`
- `.pi/themes/`

Also updated:

- `package.json` now includes `.pi` in published files
- `takomi init` copies `.pi` into the target project

### What is still an external dependency

Still external / not yet bundled as an npm dependency of this package:

- `pi-subagents` package itself
- Pi user-level/default `subagent` extension runtime
- any user/global Pi install

So the current bundling model is:

```text
Takomi ships its own Pi-native runtime bundle.
Takomi does not yet npm-bundle pi-subagents as a dependency.
Raw subagent may still exist separately in the user's Pi environment.
```

### What is preferred operationally

For Takomi work:

- prefer `takomi_subagent`
- treat `subagent` as advanced/raw escape hatch

For packaging/integration work:

- do not document raw `subagent` as the primary Takomi interface
- do not assume `pi-subagents` is already bundled by npm dependency
- do preserve compatibility with user environments where raw `subagent` exists

## Dependency Strategy

### Preferred Option: Bundle Pi Subagents by Default

Takomi should include Pi subagents as a default dependency.

```text
install Takomi
→ pi-subagents installed automatically
→ takomi_subagent works out of the box
```

This gives the best user experience.

### Acceptable Fallback: Optional Dependency Detection

If bundling is not possible, Takomi should detect whether Pi subagents is available.

If missing, show a clear error:

```text
Takomi subagent execution requires pi-subagents.
Install it with:
pi package install pi-subagents
```

Takomi board and workflow planning can still work without dispatch support.

---

## Feature Parity Requirements

Before treating Takomi subagent as the main interface, it should expose or map the important Pi subagent features.

### Execution Modes

- [ ] Single-agent execution
- [ ] Parallel execution
- [ ] Chain execution
- [ ] Async/background execution

### Runtime Control

- [ ] Status check
- [ ] Interrupt
- [ ] Resume
- [ ] Fresh/forked context support
- [ ] Conversation/session continuity

### Agent Discovery and Management

- [ ] List available agents
- [ ] Inspect agent details
- [ ] Support user/project/both scopes
- [ ] Optional create/update/delete passthrough for advanced usage

### Artifacts and Output

- [ ] Output file support
- [ ] Inline vs file-only output modes
- [ ] Progress tracking
- [ ] Session logs
- [ ] Chain artifact directory support

### Isolation and Safety

- [ ] Worktree execution support
- [ ] Project-agent confirmation behavior
- [ ] Model override and fallback support
- [ ] Diagnostics/doctor passthrough

### Takomi-Specific Additions

- [ ] Stage metadata: Genesis, Design, Build
- [ ] Workflow overlays: `vibe-genesis`, `vibe-design`, `vibe-build`
- [ ] Board task linkage
- [ ] Checklist support
- [ ] Review checkpoint support
- [ ] Redispatch support with same conversation/session when appropriate
- [ ] Lifecycle-aware handoff summaries

---

## API Design Direction

### Keep Takomi API High-Level

Example desired call shape:

```ts
takomi_subagent({
  agent: "coder",
  workflow: "vibe-build",
  task: "Implement FR-001 from docs/issues/FR-001.md",
  checklist: [
    "Read PRD",
    "Read FR issue",
    "Implement acceptance criteria",
    "Run verification"
  ]
})
```

Internally, Takomi translates this into the appropriate Pi subagent invocation.

### Allow Advanced Passthrough

For advanced users, Takomi can expose an escape hatch:

```ts
takomi_subagent({
  mode: "raw-pi",
  piOptions: { ... }
})
```

Or allow unmapped options to pass through when safe.

---

## Migration Plan

### Phase 1 — Audit Current Implementations

- [x] Locate current `takomi_subagent` implementation.
- [x] Locate current Pi `subagent` integration.
- [x] Identify whether Takomi already wraps Pi or uses a separate path.
- [x] Document feature gaps between both systems.
- [x] Identify existing tests and CLI/tool schemas.

### Phase 2 — Make Pi Subagents a Takomi Dependency

- [ ] Add `pi-subagents` as a default dependency if possible.
- [x] Ensure install flow includes subagent runtime automatically.
- [ ] Add detection/error handling if dependency is unavailable.
- [ ] Verify packaged installs work without manual user setup.

### Phase 3 — Wrap Pi Features in Takomi

- [ ] Map single execution.
- [ ] Map parallel execution.
- [ ] Map chain execution.
- [ ] Map async/status/resume/interrupt.
- [ ] Map output/progress/session options.
- [ ] Map worktree support.
- [ ] Map agent listing and inspection.
- [ ] Add Takomi lifecycle metadata to every delegated task.

### Phase 4 — Make Takomi the Preferred Interface

- [x] Update documentation to recommend `takomi_subagent`.
- [x] Update prompts/harness instructions to prefer Takomi for lifecycle work.
- [x] Hide or de-emphasize raw Pi `subagent` in user-facing docs.
- [x] Keep raw Pi access available for advanced/internal use.

### Phase 5 — Compatibility and Regression Testing

- [ ] Test single subagent execution.
- [ ] Test parallel execution.
- [ ] Test chained execution.
- [ ] Test async run and resume.
- [ ] Test worktree isolation.
- [ ] Test user/project agent scope behavior.
- [ ] Test Takomi Genesis → Design → Build board flow.
- [ ] Test review and redispatch loop.

### Phase 6 — Deprecate Direct Pi Usage Publicly

Only after compatibility passes:

- [ ] Mark raw Pi subagent as advanced/internal in docs.
- [ ] Keep it available for power users.
- [ ] Avoid deleting it unless there is a strong reason.

---

## Non-Goals

Do **not** immediately copy all Pi subagent code into Takomi.

Do **not** delete Pi subagent support until:

- Takomi has feature parity.
- Tests pass.
- Existing workflows are migrated.
- No package or harness behavior depends on raw Pi access.

Do **not** make Takomi responsible for low-level runtime details unless the upstream Pi subagent library becomes unmaintained or unsuitable.

---

## Deletion Criteria

Direct Pi subagent exposure can only be removed if all are true:

- [ ] Takomi subagent supports all required Pi features.
- [ ] Existing users have a migration path.
- [ ] Documentation has been updated.
- [ ] Tests cover old and new behavior.
- [ ] There is no dependency on raw Pi APIs from skills, packages, or harness prompts.
- [ ] The maintainability benefit outweighs the loss of escape-hatch power.

Until then, prefer hiding/de-emphasizing over deleting.

---

## Implementation Update

- Updated `.pi/extensions/takomi-subagents/agents.ts` to use Pi's configured user agent directory via `getAgentDir()` instead of hard-coding `~/.pi`, while also supporting legacy project-local `.agents/` discovery.
- Updated `package.json` to ship the Pi-native `.pi` Takomi runtime bundle.
- Updated `src/utils.js` and `src/cli.js` so project installation copies the `.pi` runtime automatically alongside legacy assets.
- Updated `.pi/README.md` to make `takomi_subagent` the preferred interface and document raw `subagent` usage as advanced/internal.
- Full `pnpm exec tsc --noEmit` remains blocked by pre-existing `.pi/extensions/oauth-router/*` errors unrelated to the Takomi subagent changes.

## Final Recommendation

The best long-term model is:

```text
Takomi is the orchestration product.
Pi subagents is the maintained execution engine.
Takomi subagent wraps Pi subagents.
Pi subagents is bundled by default.
Raw Pi subagent access remains available but advanced/internal.
```

This gives users one clean mental model while preserving the stability and feature depth of the maintained subagent runtime.
