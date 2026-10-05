# BLD-001: Upgrade Pi and verify native compatibility

## Agent setup
Follow the focused Vibe Build workflow. Actual cwd must be the isolated worktree at C:/CreativeOS/01_Projects/Code/Personal_Stuff/2025-12-02_VibeCode-Protocol-Suite/.worktrees/takomi-efficiency. Read AGENTS.md and unslop before user-facing text. Read the original checkout's docs/tasks/orchestrator-sessions/orch-20260929-223951/master_plan.md, build_proposal.md, finding_register.md and GEN-003.report.md. This packet may move to in-progress; find it by BLD-001 prefix if needed.

## Objective
Upgrade the supported local Pi baseline from 0.84.4 to exact 0.99.1, as explicitly authorized by the user, and prove the existing Takomi integration still works without changing global resources or unrelated behavior.

## Scope
Own package.json, pnpm-lock.yaml, the subagent compatibility manifest/probe and strictly necessary extension/API compatibility corrections. Inspect all four Pi packages together. Keep pi-subagents 0.31.0 and the existing native renderer patch unless a reproduced incompatibility makes a change necessary. Native tool exposure is a capability finding, not a default change in this task. Own compatibility findings I01/I03/I04 and the local-launch aspect of I02.

## Prime code and documentation
Read package.json, pnpm-lock.yaml, tsconfig.json, src/postinstall.js, src/patch-pi-subagents-renderer.js, .pi/extensions/takomi-subagents/pi-subagents-internal.ts, pi-subagents-engine.ts, compatibility JSON and scripts/test-pi-subagents-compatibility.js, scripts/pi-dev.ps1 and src/pi-harness.js. For Pi work, read complete relevant 0.99.1 docs and linked examples under C:/Users/johno/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent, then verify against the newly installed local package. Prior reports used global docs conditionally; new compatibility claims require local verification.

## Implementation rules
- Work only in the isolated worktree. Do not modify original source files, global Pi, home settings, credentials, real session logs or Codex.
- Update all four exact Pi versions to 0.99.1 and the compatibility manifest consistently. Regenerate the lockfile with pnpm and scripts disabled, then verify frozen-lockfile installation. Network access solely for package resolution/install is authorized.
- Read installation scripts before any local execution. Prefer pnpm patch support; run only a strictly necessary local renderer patch explicitly. No global install/sync or broad postinstall automation.
- Preserve exact model routing, trust/capability/cwd gates, hard stops, all native tool contracts, child context defaults and provider option forwarding. Correct migrated APIs/types idiomatically without new any/as any or broad casts.
- Reproduce failures before editing. Fix confirmed upgrade regressions only, not unrelated old test/style issues. A necessary wider subagent upgrade, public/private API replacement or large architecture change needs an explicit blocker report, not an unbounded rewrite.
- Use git -c core.longpaths=true when the nested Windows path requires it. Do not commit, rebase, merge or delete resources.

## Dependencies
GEN-001, GEN-002 and GEN-003 are complete. User approved first-pass Build and the Pi version upgrade. This is the only active code writer; subsequent Build tasks await its compatibility outcome.

## Definition of done
- Exact local Pi 0.99.1 package versions, updated lockfile and manifest agree; frozen install succeeds.
- Offline compatibility probe successfully loads guarded native imports and the renderer patch, with no live model/auth requests.
- Typecheck and focused context-manager, routing safety, project trust and relevant native lifecycle checks pass, or confirmed blockers are explicitly recorded.
- A development/offline launch uses the local resolved CLI and explicit extension set rather than depending on global PATH; modify the existing launcher only if necessary to establish that contract.
- Record which native deferred exposure APIs are available and compatible; do not activate them by default.
- Minimal migration diff; no weakened tests or unrelated refactor.

## Expected artifacts
Worktree implementation and lockfile diff, any targeted compatibility/documentation updates, exact commands/results and a concise final handoff listing changed files, native tool capability findings, remaining blockers and test coverage. Keep a reusable conversation/session ID for focused reviewer revisions. No live benchmarks.

## Review checkpoint
A separate read-only reviewer checks the upgrade diff and offline evidence before the orchestrator accepts BLD-001 or launches dependent writers.
