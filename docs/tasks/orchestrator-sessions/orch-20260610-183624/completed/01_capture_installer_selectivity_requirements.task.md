# Task 01: Capture Installer Selectivity Requirements

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
- Takomi workflow: `vibe-genesis`

### Prime Agent Context
Read first:
- `docs/tasks/orchestrator-sessions/orch-20260610-183624/master_plan.md`
- `src/cli.js`
- `src/skills-installer.js`
- `src/store.js`
- `src/harness.js`
- Pi docs: `docs/skills.md`, `docs/packages.md`, `docs/extensions.md` from the installed Pi documentation path.

### Optional Skill / Context Overlays
| Overlay | Reason |
| --- | --- |
| None | Repo and Pi docs are enough for requirements capture. |

## Objective
Capture the user’s desired change: Takomi must stop default-installing every bundled skill/workflow, introduce categorized selection, and prune only Takomi-owned deselected resources.

## Scope
- Understand current code paths for setup/install/refresh/sync.
- Identify resource ownership/pruning requirements.
- Preserve the user’s explicit list of non-default AI content skills.

## Context
The current implementation has multiple paths that still install or sync all skills. `installBundledSkills()` installs all bundled skills into `~/.agents/skills`. `takomi refresh all` calls the skills installer. Global store sync copies whatever exists in the store but does not prune deselected Takomi-owned resources.

## Definition Of Done
- [x] User request summarized.
- [x] Current code paths identified.
- [x] Risks and constraints recorded.
- [x] Follow-up design/build tasks created.

## Expected Artifacts
- Updated `master_plan.md` with requirements and task breakdown.

## Constraints
- Do not delete user-owned/manual skills.
- Do not remove optional skills from the package just because they should not be default.

## Verification
Manual review of the master plan and scanned source references.
