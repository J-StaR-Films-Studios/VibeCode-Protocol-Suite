# Task 03: Implement Categorized Resource Selection and Ownership-Safe Prune

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
- Takomi workflow: `vibe-build`

### Prime Agent Context
Read first:
- `docs/tasks/orchestrator-sessions/orch-20260610-183624/master_plan.md`
- Task 02 design artifact once completed
- `src/cli.js`
- `src/skills-installer.js`
- `src/store.js`
- `src/harness.js`
- `src/utils.js`

### Optional Skill / Context Overlays
| Overlay | Reason |
| --- | --- |
| None | Standard Node CLI/resource-management implementation. |

## Objective
Implement the approved design so Takomi setup/refresh/sync no longer installs every skill by default and can prune deselected Takomi-owned resources safely.

## Scope
- Add shared resource metadata/taxonomy for skills/workflows.
- Add selection resolution for essentials, categories, custom selection, and explicit all.
- Update `installBundledSkills`, store population, harness sync, project setup, and refresh flows to use shared selection/reconcile.
- Implement manifest-based ownership tracking and prune logic.
- Ensure AI media/content skills are optional/non-default.

## Context
Current install paths overwrite/copy broadly. New behavior must be intentional, repeatable, and safe.

## Definition Of Done
- [ ] Default setup/refresh does not install all skills.
- [ ] User can explicitly include optional categories or all resources.
- [ ] Deselected Takomi-owned resources are removed from destination.
- [ ] Manually added/non-owned resources are preserved.
- [ ] Modified Takomi-owned resources are preserved or warned according to design.
- [ ] CLI summaries explain installed, pruned, preserved, and skipped resources.

## Expected Artifacts
- Source changes in `src/`.
- Any new metadata files needed by package distribution.
- Tests/fixtures if the test task is folded into implementation.

## Constraints
- Maintain ESM module style.
- Preserve legacy command aliases.
- Do not remove packaged skill directories unless the design explicitly calls for packaging cleanup.

## Dependencies
- Task 02 completed design.

## Verification
Run targeted Node/CLI tests or dry-run scripts that verify selected/default/all/custom/prune cases.
