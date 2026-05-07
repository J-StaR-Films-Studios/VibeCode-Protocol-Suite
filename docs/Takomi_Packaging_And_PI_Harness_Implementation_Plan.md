# Takomi Packaging + Pi Harness Implementation Plan

## Objective

## Current packaging reality

Before further packaging work, assume the following are true:

- Takomi now ships the project-local Pi-native `.pi` runtime bundle in `package.json`
- `takomi init` now copies `.pi` into the target project automatically
- this means Takomi-owned runtime assets are now bundled at the package level
- however, Takomi does **not yet** declare `pi-subagents` as a direct npm dependency
- and `takomi_subagent` does **not yet** invoke raw Pi `subagent` directly as a tool passthrough

So there are three separate concepts to keep distinct:

1. **Takomi bundled assets**
   - `.pi/extensions/takomi-runtime/`
   - `.pi/extensions/takomi-subagents/`
   - `.pi/prompts/`
   - `.pi/agents/`
   - `.pi/themes/`
   - `src/pi-takomi-core/`

2. **Host Pi runtime dependencies**
   - user/global Pi installation
   - Pi model registry/runtime behavior
   - any user-level default `subagent` tool registration

3. **Future desired dependency bundling**
   - direct npm-level bundling of `pi-subagents`
   - explicit detection/doctor flows for missing Pi/runtime pieces
   - tighter bridge between `takomi_subagent` and the raw Pi subagent execution engine

Agents working on packaging should not collapse these concepts together.

In particular:

- do not claim that `pi-subagents` is already bundled unless that dependency is actually added
- do not assume raw `subagent` is always present in every environment
- do not assume `takomi_subagent` already delegates by calling raw `subagent`
- do treat `takomi_subagent` as the preferred Takomi-facing interface for user workflows

Evolve Takomi from a multi-harness skills/workflows installer into a polished distribution package that can install and launch a Pi-native Takomi harness while still supporting optional reusable skills/workflows for other harnesses.

The primary user experience should become:

```bash
npm install -g takomi
takomi install pi
cd my-project
takomi
```

Where `takomi` with no arguments launches the Pi-based Takomi harness, and `takomi install`, `takomi sync`, `takomi init`, etc. remain management commands.

---

## Product Model

### 1. Takomi CLI

The `takomi` npm package is the distribution, installer, launcher, and sync manager.

It should own:

- installing/updating Pi if needed
- installing/updating the Takomi Pi harness assets
- optionally installing global skills into `~/.agents`
- syncing packaged assets to connected harnesses
- project initialization
- diagnostics/doctor checks
- launching the Takomi harness via `takomi`

The CLI is **not identical to the Pi harness**. It manages the harness.

### 2. Pi Takomi Harness

Installed by:

```bash
takomi install pi
```

Contains:

- Takomi runtime extension
- Takomi subagents extension
- Takomi commands
- Takomi routing-policy support
- Takomi subagent UI/rendering
- Takomi default agents
- Takomi prompt aliases
- Takomi theme
- embedded Genesis / Design / Build workflows

This is the first-class supported runtime.

### 3. Generic Skills Bundle

Installed separately by:

```bash
takomi install skills
```

Target:

```text
~/.agents/skills
```

On Windows:

```text
C:\Users\<user>\.agents\skills
```

Skills should remain optional. Users may want the Pi Takomi harness without installing the whole skill library.

### 4. Workflows

For Pi, workflows should be embedded directly into the Takomi runtime so the orchestrator does not depend on external skill/workflow files.

For other harnesses, workflows can still be exported as markdown prompt packs where useful.

### 5. Routing Policy

Routing policy is configuration, not hardcoded package behavior.

Project-level:

```text
.pi/takomi/model-routing.md
.pi/settings.json
```

Future user/global-level:

```text
~/.pi/agent/takomi/model-routing.md
~/.pi/agent/settings.json
```

Priority order:

1. project routing policy
2. user/global routing policy
3. bundled default routing policy

Users should be able to update routing from inside Pi/Takomi conversationally:

```text
Update Takomi routing logic:
"""
...
"""
```

And from CLI eventually:

```bash
takomi routing set ./routing.md
takomi routing show
```

---

## Recommended CLI UX

### Install Pi Harness

```bash
takomi install pi
```

Behavior:

1. Detect whether `pi` is available.
2. If missing, install latest Pi package from npm.
3. Install/sync Takomi Pi harness assets.
4. Optionally ask whether to install skills.
5. Run doctor checks.
6. Print next command:

```bash
cd <project>
takomi
```

### Install Skills Only

```bash
takomi install skills
```

Installs reusable Takomi skills to `~/.agents/skills`.

### Install All

```bash
takomi install all
```

Installs:

- Pi harness
- global skills
- configured supported harness assets

### Launch Harness

```bash
takomi
```

No-argument `takomi` should launch the Pi Takomi harness.

It should:

1. Verify Pi exists.
2. Verify Takomi Pi harness appears installed.
3. If missing, suggest or offer `takomi install pi`.
4. Start Pi in the current working directory.
5. Optionally set environment variable:

```bash
TAKOMI_HARNESS=1
```

Then spawn:

```bash
pi
```

Management commands must still work:

```bash
takomi install
takomi sync
takomi init
takomi doctor
takomi harnesses
takomi update
```

Implementation pattern:

```js
if (process.argv.length <= 2) {
  await launchTakomiHarness();
} else {
  program.parse();
}
```

### Project Init

```bash
takomi init
```

Creates project-local config/docs only. It should not reinstall global assets.

Possible project files:

```text
.pi/settings.json
.pi/takomi-profile.json
.pi/takomi/model-routing.md optional template
docs/ optional Takomi planning docs
```

### Sync

```bash
takomi sync
```

Updates installed assets from the currently installed npm package.

Should not overwrite user-owned config such as:

- `.pi/settings.json`
- `.pi/takomi/model-routing.md`
- user routing policies

### Doctor

```bash
takomi doctor
```

Checks:

- `takomi` CLI version
- Pi installation/version
- Pi model registry accessible if possible
- Takomi runtime extension installed
- Takomi subagents extension installed
- prompts/agents/themes installed
- routing policy found or missing
- global skills installed or missing
- connected harnesses

---

## Installation Targets

### Pi Global/User Target

Install bundled Pi assets to the correct Pi user-level extension locations. Confirm exact paths from Pi docs/runtime.

Likely targets:

```text
~/.pi/agent/extensions/takomi-runtime
~/.pi/agent/extensions/takomi-subagents
~/.pi/agent/prompts
~/.pi/agent/agents
~/.pi/agent/themes
~/.pi/agent/settings.json
```

### Project Target

For project-local Takomi config:

```text
.pi/extensions/        optional/project-local dev copy
.pi/prompts/           optional/project-local overrides
.pi/agents/            optional/project-local overrides
.pi/themes/            optional/project-local theme
.pi/settings.json
.pi/takomi-profile.json
.pi/takomi/model-routing.md
```

### Generic Skills Target

```text
~/.agents/skills
```

On Windows:

```text
C:\Users\<user>\.agents\skills
```

---

## Asset Packaging Structure

Recommended package structure:

```text
takomi/
├─ bin/
│  └─ takomi.js
├─ src/
│  ├─ cli/
│  ├─ pi-takomi-core/
│  └─ installers/
├─ packages/
│  └─ pi/
│     ├─ extensions/
│     │  ├─ takomi-runtime/
│     │  └─ takomi-subagents/
│     ├─ prompts/
│     ├─ agents/
│     ├─ themes/
│     └─ manifest.json
├─ skills/
│  └─ ... optional skill bundle ...
├─ workflows/
│  └─ ... exported workflow prompt versions for non-Pi harnesses ...
└─ templates/
   ├─ project-pi/
   └─ routing/
```

Current repo can be migrated gradually. Do not require a full restructure before shipping the launcher.

---

## Versioned Asset Sync

Add an install manifest so sync can update package-owned files safely.

Example:

```json
{
  "takomiVersion": "2.1.0",
  "installedAt": "2026-...",
  "targets": {
    "pi": {
      "runtime": "hash",
      "subagents": "hash",
      "prompts": "hash",
      "agents": "hash",
      "themes": "hash"
    },
    "skills": {
      "path": "~/.agents/skills",
      "hash": "hash"
    }
  }
}
```

Sync rules:

- update package-owned extension/prompt/theme/agent files
- preserve user config
- preserve routing policy
- warn before overwriting modified package-owned files

---

## Model Provider / Routing Integration

The Takomi runtime should inject:

1. active routing policy
2. available Pi model/provider registry context
3. instruction to use provider-qualified model IDs

The model should not be instructed to run visible `pi --list-models` every time.

Correct behavior:

- use `ctx.modelRegistry.getAvailable()` inside runtime/subagent dispatch
- prefer provider-qualified model IDs like `oauth-router/gpt-5.5`
- allow per-agent defaults in `.pi/settings.json`
- only run `pi --list-models` if registry context is missing or user asks for diagnostics

Example project settings:

```json
{
  "takomi": {
    "modelRoutingPolicyFile": ".pi/takomi/model-routing.md"
  },
  "subagents": {
    "agentOverrides": {
      "reviewer": {
        "model": "oauth-router/gpt-5.5",
        "thinking": "high"
      },
      "planner": {
        "model": "oauth-router/gpt-5.5",
        "thinking": "medium"
      },
      "worker": {
        "model": "oauth-router/gpt-5.4",
        "thinking": "high"
      },
      "scout": {
        "model": "oauth-router/gpt-5.4-mini",
        "thinking": "high"
      }
    }
  }
}
```

---

## Forking / Rebranding Pi

Pi is MIT licensed, so a fork/rebrand is legally possible if license/copyright obligations are preserved.

However, do **not** start with a fork.

Recommended staged approach:

### Phase 1 — Wrapper

`takomi` launches installed Pi with Takomi harness installed.

Low risk, easy updates, no upstream fork maintenance.

### Phase 2 — Branded Harness Mode

Launch Pi with environment variable:

```bash
TAKOMI_HARNESS=1 pi
```

Takomi extensions/theme/footer make the UI feel like Takomi.

### Phase 3 — Full Fork/Binary

Only later, if needed, build a branded Takomi binary from Pi source.

Reason to delay:

- avoids maintaining a Pi fork immediately
- keeps compatibility with upstream Pi
- reduces release burden
- faster product iteration

---

## Implementation Tasks

### Task 1: CLI Command Design

Update `src/cli.js` / command registration:

- add no-argument launcher behavior
- preserve existing subcommands
- add install target parsing: `install pi`, `install skills`, `install all`
- add `doctor` command
- optionally add `routing` command group

Acceptance:

- `takomi` launches harness
- `takomi install` still works
- `takomi install pi` works or produces clear TODO-supported output
- `takomi --help` documents new behavior

### Task 2: Pi Installer

Implement `takomi install pi`:

- detect Pi command
- install Pi if missing, preferably via npm
- copy/install Takomi Pi harness assets
- write install manifest
- run basic validation

Acceptance:

- fresh machine can run `npm install -g takomi && takomi install pi`
- after install, `takomi` starts Pi

### Task 3: Launcher

Implement `launchTakomiHarness()`:

- check `pi` executable
- check Takomi harness install marker
- set `TAKOMI_HARNESS=1`
- spawn `pi` with inherited stdio
- forward exit code

Acceptance:

- `takomi` launches Pi in current folder
- helpful error if Pi/harness missing

### Task 4: Skills Installer

Implement/refine:

```bash
takomi install skills
```

Target `~/.agents/skills`.

Acceptance:

- installs bundled skills
- does not require Pi
- does not overwrite user edits without warning

### Task 5: Sync + Manifest

Add versioned asset manifest.

Acceptance:

- `takomi sync pi` updates Pi harness assets
- `takomi sync skills` updates skill bundle
- user routing/settings are preserved

### Task 6: Doctor

Implement:

```bash
takomi doctor
```

Acceptance:

- reports Pi installed/missing
- reports Takomi harness installed/missing
- reports skills installed/missing
- reports routing policy status
- provides clear fix commands

### Task 7: Documentation

Update README with:

```bash
npm install -g takomi
takomi install pi
cd my-project
takomi
```

Also document:

```bash
takomi install skills
takomi init
takomi sync
takomi doctor
```

---

## Non-Goals For First Pass

- Do not fork/recompile Pi yet.
- Do not rename all Pi internals to Takomi yet.
- Do not force skills installation during Pi harness install.
- Do not overwrite routing policy/settings during sync.
- Do not depend on visible `pi --list-models` preflight for normal operation.

---

## Final Desired UX

First install:

```bash
npm install -g takomi
takomi install pi
```

Optional skills:

```bash
takomi install skills
```

Project:

```bash
cd my-project
takomi init
```

Daily use:

```bash
cd my-project
takomi
```

Inside the harness:

```text
use takomi
```

or simply ask for orchestration if Takomi auto-routing is enabled.
