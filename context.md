# Code Context

## Files Retrieved
1. `README.md` (lines 1-220, 240-419) - project purpose, repo map, and lifecycle workflows (`vibe-genesis` → `vibe-design` → `vibe-build`).
2. `package.json` (lines 1-50) - package identity, CLI entry, and core deps (`commander`, `prompts`, `pi-subagents`).
3. `bin/takomi.js` (lines 1-2) - CLI bootstrap into `src/cli.js`.
4. `src/cli.js` (lines 1-220) - installer/sync entrypoint; copies workflows, skills, agent YAMLs, and Pi assets.
5. `src/pi-takomi-core/types.ts` (lines 1-115) - core roles, workflow IDs, session/task types, and subagent modes.
6. `src/pi-takomi-core/orchestration.ts` (lines 1-160) - session IDs, task/stage mapping, markdown/session path helpers.
7. `src/pi-takomi-core/routing.ts` (lines 1-80) - lifecycle/role detection and routing decisions.
8. `src/pi-takomi-core/workflows.ts` (lines 1-40) - canonical `vibe-genesis`, `vibe-design`, `vibe-build` definitions.
9. `src/pi-takomi-core/validation.ts` (lines 1-120) - validates session JSON/task integrity and stage consistency.
10. `.pi/README.md` (lines 1-120) - Pi-native runtime contract, ownership model, and session-state layout.
11. `.pi/agents/architect.md`, `coder.md`, `designer.md`, `orchestrator.md`, `reviewer.md` (lines 1-34 each) - project-level specialist agent defs.
12. `assets/Takomi-Agents/custom_modes.yaml` (lines 2, 205, 440, 651, 809, 950, 1097) - KiloCode custom modes for `vibe-visionary`, `vibe-orchestrator`, `vibe-code`, `vibe-architect`, `vibe-review`, `vibe-ask`, `vibe-debug`.
13. `.pi/extensions/oauth-router/provider.ts` (lines ~82-540) and `.pi/extensions/oauth-router/state.ts` (lines ~102-360) - current dirty worktree; abort/cancel handling changes.
14. `.pi/takomi/orchestrator/orch-20260514-220255.json`, `.pi/takomi/orchestrator/orch-20260530-143141.json`, `.pi/takomi/orchestrator/orch-20260601-222051.json` - persisted orchestration session state.
15. `docs/tasks/orchestrator-sessions/orch-20260514-220255/master_plan.md` + `pending/*.task.md` - markdown task/session artifacts.

## Key Code
- Takomi is a CLI/workflow bundle for AI-assisted project orchestration, centered on the Genesis → Design → Build lifecycle.
- Core model types live in `src/pi-takomi-core/types.ts` (`TakomiRole`, `TakomiWorkflowId`, `OrchestratorSessionState`, `TakomiSubagentMode`).
- `src/pi-takomi-core/routing.ts` decides whether a request should go direct or orchestrated.
- `src/pi-takomi-core/orchestration.ts` owns session IDs (`orch-YYYYMMDD-HHMMSS`) and task/stage derivation.
- `src/pi-takomi-core/validation.ts` enforces session/task consistency and warns on oversized JSON prose.
- `src/cli.js` is the installer/sync surface that packages `.agent`, `Takomi-Agents`, legacy prompts, and bundled Pi assets.
- The dirty OAuth router patch adds `isAbortLike()` and `clearAbortHealth()` so aborts/cancels don’t poison router health.

## Architecture
- `bin/takomi.js` boots the CLI in `src/cli.js`.
- `src/` is the published runtime/installer layer.
- `src/pi-takomi-core/` is the shared decision engine for workflows, routing, orchestration state, and validation.
- `.pi/` is the Pi-native runtime bundle (agents, extensions, prompts, saved orchestration state).
- `assets/` holds cross-harness workflow/mode definitions and legacy prompt material.
- `docs/tasks/orchestrator-sessions/` and `.pi/takomi/orchestrator/` store authored session artifacts and machine state.
- No explicit saved chain files (`*.chain.md` / `*.chain.json`) were found in the repo.

## Git Status
- Branch: `quick-fixes` tracking `origin/quick-fixes`.
- Modified: `.pi/extensions/oauth-router/provider.ts`, `.pi/extensions/oauth-router/state.ts`.
- Diff size: 50 insertions / 2 deletions; changes focus on abort-aware router handling.

## Start Here
`README.md` — fastest overview of Takomi’s purpose, workflows, and repo layout; then `src/pi-takomi-core/types.ts` for the shared execution model.

## Next Delegations
1. **Review specialist**: audit the dirty OAuth router patch in `.pi/extensions/oauth-router/provider.ts` and `.pi/extensions/oauth-router/state.ts` for regressions in auth/rate-limit cooldown handling.
2. **Architect specialist**: reconcile the duplicate role definitions between `.pi/agents/*.md` and `assets/Takomi-Agents/custom_modes.yaml` and decide the canonical source of truth.
3. **Orchestrator/doc specialist**: define whether `.pi/takomi/orchestrator/*.json` should remain session state only or be complemented by explicit reusable saved chains (`*.chain.md` / `*.chain.json`).
