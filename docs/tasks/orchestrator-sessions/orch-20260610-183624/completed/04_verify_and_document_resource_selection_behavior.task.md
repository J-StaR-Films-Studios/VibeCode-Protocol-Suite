# Task 04: Verify and Document Resource Selection Behavior

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
- Takomi workflow: `vibe-build` with review/finalize checkpoint

### Prime Agent Context
Read first:
- `docs/tasks/orchestrator-sessions/orch-20260610-183624/master_plan.md`
- Task 02 design artifact
- Task 03 implementation diff
- `README.md`
- `package.json`

### Optional Skill / Context Overlays
| Overlay | Reason |
| --- | --- |
| None | Verification and docs task. |

## Objective
Prove the new installer behavior is safe and document it clearly for users.

## Scope
- Add/adjust tests or reproducible fixtures for install/setup/refresh/sync paths.
- Verify non-default optional AI skills remain uninstalled unless selected.
- Verify deselection removes only Takomi-owned resources.
- Verify manual skills remain untouched.
- Update README/help text/migration notes.

## Definition Of Done
- [ ] Tests or documented verification commands cover default, category, custom, all, refresh, and prune cases.
- [ ] Docs explain ownership-safe pruning and optional categories.
- [ ] CLI help no longer implies all-skills defaults.
- [ ] Final summary lists changed behavior and migration considerations.

## Expected Artifacts
- Test files/scripts or verification report.
- README/help/docs updates.
- Final orchestrator summary.

## Constraints
- Do not perform destructive operations against a real user home directory during tests; use temp dirs/mocks.

## Dependencies
- Task 03 implementation complete.

## Verification
Reviewer checks test output and docs against the original user request.
