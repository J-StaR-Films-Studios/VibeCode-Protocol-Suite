# Task 02: Design Resource Taxonomy and Ownership-Safe Reconcile

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
- Takomi workflow: `vibe-design`

### Prime Agent Context
Read first:
- `docs/tasks/orchestrator-sessions/orch-20260610-183624/master_plan.md`
- `src/cli.js`
- `src/skills-installer.js`
- `src/store.js`
- `src/harness.js`
- `src/utils.js`
- `package.json`

### Optional Skill / Context Overlays
| Overlay | Reason |
| --- | --- |
| Pi docs: skills/packages/extensions | Confirm resource discovery, package filters, and CLI/UI possibilities. |

## Objective
Design a shared Takomi resource selection and ownership model that prevents all-skills default installs and supports safe pruning of deselected Takomi-owned resources.

## Scope
- Define skill/workflow categories and default packs.
- Decide where the listed AI content skills belong and ensure they are not defaults.
- Design CLI prompt flow compatible with current `prompts` dependency, including a path toward expandable category UI if needed.
- Design manifest schema for ownership, selected resources, hashes, target roots, and preservation warnings.
- Define reconcile algorithm for install, refresh, sync, and project setup.

## Context
User wants category-level selection with section defaults, select-all by section, expandable rows/right-arrow for individual deselection, and automatic deletion of deselected Takomi-installed resources only. Manual user skills must remain untouched.

## Definition Of Done
- [ ] Design doc names exact modules/functions to change.
- [ ] Design includes category taxonomy and default selections.
- [ ] Design includes ownership-safe deletion algorithm.
- [ ] Design covers `setup pi`, `setup skills`, `setup all`, `refresh`, legacy aliases, global store sync, and workflows.
- [ ] Design states migration/backward compatibility behavior.

## Expected Artifacts
- A design spec under `docs/features/` or this session folder.
- Updated task packet(s) for Build if scope changes.

## Constraints
- Must not delete resources not recorded as Takomi-owned.
- Must preserve modified Takomi-owned resources unless the design intentionally prompts/flags replacement.
- Must not rely on Pi package filtering alone because Takomi copies resources into several harness-specific paths.

## Verification
Reviewer can trace every installer/sync entry point to the shared reconcile behavior.
